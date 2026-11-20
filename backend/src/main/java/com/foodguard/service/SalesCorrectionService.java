package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.SalesData;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.util.UnitUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 문자로 요청하는 판매 수정·취소. Claude 는 요청을 "어느 날 어느 메뉴를 몇 개로"로만 바꾼다.
 * 미리보기·반영은 코드가 하고, 점주가 확인한 뒤에만 저장한다.
 * POS 결제(단가 기록 있음)는 결제 때 재고를 줄였으므로 재고도 되돌리고, 파일로 등록한 판매는 재고를 건드리지 않는다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SalesCorrectionService {

    static final int CONTEXT_DAYS = 14;
    static final int MAX_QUANTITY = 10000;

    private final AiClient aiClient;
    private final SalesDataRepository salesDataRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public Map<String, Object> propose(Long storeId, String message) {
        LocalDate today = LocalDate.now();
        Map<String, Menu> byKey = new HashMap<>();
        Map<String, Integer> totals = new TreeMap<>();
        for (SalesData s : recentSales(storeId, today)) {
            String key = s.getSaleDate() + "/" + s.getMenu().getId();
            totals.merge(key, s.getQuantity(), Integer::sum);
            byKey.put(key, s.getMenu());
        }
        List<Map<String, Object>> sales = new ArrayList<>();
        totals.forEach((key, qty) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("saleDate", key.substring(0, 10));
            row.put("menuId", byKey.get(key).getId());
            row.put("menuName", byKey.get(key).getMenuName());
            row.put("total", qty);
            sales.add(row);
        });
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("today", today.toString());
        body.put("sales", sales);
        Map<String, Object> ai = aiClient.post("/api/agents/sales-correction", body);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> actions = (List<Map<String, Object>>) ai.getOrDefault("actions", List.of());
        List<Map<String, Object>> previews = new ArrayList<>();
        for (Map<String, Object> action : actions) {
            previews.add(preview(storeId, Long.valueOf(action.get("menuId").toString()),
                    LocalDate.parse(action.get("saleDate").toString()), ((Number) action.get("newTotal")).intValue()));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("understood", ai.get("understood"));
        result.put("clarification", ai.get("clarification"));
        result.put("changes", previews);
        return result;
    }

    // 점주가 확인한 내용만 반영. 미리보기 뒤 판매가 바뀌었으면(expectedTotal 불일치) 다시 확인하게 한다
    @Transactional
    public Map<String, Object> apply(Long storeId, List<Map<String, Object>> changes, String reason) {
        if (changes == null || changes.isEmpty()) throw new RuntimeException("반영할 수정 내용이 없습니다.");
        int updated = 0;
        for (Map<String, Object> change : changes) {
            Long menuId = Long.valueOf(change.get("menuId").toString());
            LocalDate date = LocalDate.parse(change.get("saleDate").toString());
            int expected = Integer.parseInt(change.get("currentTotal").toString());
            int newTotal = Integer.parseInt(change.get("newTotal").toString());
            Menu menu = storeMenu(storeId, menuId);
            validate(date, newTotal);

            List<SalesData> rows = rows(storeId, menuId, date);
            int current = rows.stream().mapToInt(SalesData::getQuantity).sum();
            if (current != expected) throw new RuntimeException("확인하는 사이 판매가 바뀌었습니다. 다시 요청해 주세요.");
            if (current == 0) throw new RuntimeException("수정할 판매가 없습니다.");
            if (current == newTotal) continue;

            applyToRows(rows, newTotal).forEach((sale, delta) -> adjustStock(storeId, menuId, sale, delta));
            updated++;

            String text = String.format("판매 수정: %s %s %d개 → %d개 (요청: %s)", date, menu.getMenuName(), current, newTotal, shorten(reason));
            log.info("[판매 수정] store={} {}", storeId, text);
            notificationService.create(storeId, text, "SALES");
        }
        return Map.of("updated", updated);
    }

    /**
     * 판매 행을 합계 newTotal 에 맞춘다. 줄일 때는 최근 행부터 줄이고 0 이 되면 삭제 표시, 늘릴 때는 최근 행의 수량을 늘린다.
     * 반환: {행: 수량 변화}
     */
    static Map<SalesData, Integer> applyToRows(List<SalesData> rows, int newTotal) {
        List<SalesData> latestFirst = rows.stream()
                .sorted(Comparator.comparing(SalesData::getId, Comparator.nullsLast(Comparator.reverseOrder()))).toList();
        int current = rows.stream().mapToInt(SalesData::getQuantity).sum();
        Map<SalesData, Integer> deltas = new LinkedHashMap<>();
        if (newTotal > current) {
            SalesData latest = latestFirst.get(0);
            latest.setQuantity(latest.getQuantity() + newTotal - current);
            deltas.put(latest, newTotal - current);
            return deltas;
        }
        int remaining = current - newTotal;
        for (SalesData row : latestFirst) {
            if (remaining == 0) break;
            int take = Math.min(remaining, row.getQuantity());
            if (take == row.getQuantity()) {
                row.setIsDeleted(true);  // 수량은 기록으로 남긴다
            } else {
                row.setQuantity(row.getQuantity() - take);
            }
            deltas.put(row, -take);
            remaining -= take;
        }
        return deltas;
    }

    // 판매가 delta 만큼 늘면 재고는 그만큼 줄어든다. 재고 행이 없는 식자재는 건너뛴다 (POS 결제와 같은 규칙)
    private void adjustStock(Long storeId, Long menuId, SalesData sale, int delta) {
        if (sale.getUnitPrice() == null) return;  // POS 결제가 아니면 재고를 줄인 적이 없다
        for (MenuIngredient mi : menuIngredientRepository.findByMenuId(menuId)) {
            inventoryRepository.findByStoreIdAndIngredientId(storeId, mi.getIngredient().getId()).ifPresent(inv -> {
                double used = perUnit(mi) * delta;
                inv.setCurrentQty(inv.getCurrentQty().subtract(BigDecimal.valueOf(used)));
                inventoryRepository.save(inv);
            });
        }
    }

    private Map<String, Object> preview(Long storeId, Long menuId, LocalDate date, int newTotal) {
        Menu menu = storeMenu(storeId, menuId);
        validate(date, newTotal);
        List<SalesData> rows = rows(storeId, menuId, date);
        int current = rows.stream().mapToInt(SalesData::getQuantity).sum();
        if (current == 0) throw new RuntimeException(date + " " + menu.getMenuName() + " 판매 기록이 없습니다.");

        // 실제 행은 건드리지 않고 복사본으로 계산한다
        List<SalesData> copies = rows.stream().map(SalesCorrectionService::copy).toList();
        long amountChange = 0;
        int posDelta = 0;
        for (Map.Entry<SalesData, Integer> e : applyToRows(copies, newTotal).entrySet()) {
            SalesData s = e.getKey();
            amountChange += (long) (s.getUnitPrice() != null ? s.getUnitPrice() : menu.getPrice()) * e.getValue();
            if (s.getUnitPrice() != null) posDelta += e.getValue();
        }
        List<Map<String, Object>> stock = new ArrayList<>();
        if (posDelta != 0) {
            for (MenuIngredient mi : menuIngredientRepository.findByMenuId(menuId)) {
                Optional<Inventory> inv = inventoryRepository.findByStoreIdAndIngredientId(storeId, mi.getIngredient().getId());
                if (inv.isEmpty()) continue;
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("ingredient", mi.getIngredient().getName());
                item.put("change", Math.round(-perUnit(mi) * posDelta * 1000) / 1000.0);
                item.put("unit", inv.get().getUnit());
                stock.add(item);
            }
        }
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("menuId", menuId);
        p.put("menuName", menu.getMenuName());
        p.put("saleDate", date.toString());
        p.put("currentTotal", current);
        p.put("newTotal", newTotal);
        p.put("amountChange", amountChange);
        p.put("stockChanges", stock);
        return p;
    }

    private static SalesData copy(SalesData s) {
        SalesData c = new SalesData();
        c.setId(s.getId());
        c.setQuantity(s.getQuantity());
        c.setUnitPrice(s.getUnitPrice());
        return c;
    }

    private static double perUnit(MenuIngredient mi) {
        return UnitUtils.convertToBaseUnit(mi.getQtyPerUnit().doubleValue(), mi.getUnit(), mi.getIngredient().getUnit());
    }

    private static void validate(LocalDate date, int newTotal) {
        LocalDate today = LocalDate.now();
        if (date.isAfter(today)) throw new RuntimeException("미래 날짜의 판매는 수정할 수 없습니다.");
        if (ChronoUnit.DAYS.between(date, today) >= CONTEXT_DAYS) {
            throw new RuntimeException("최근 " + CONTEXT_DAYS + "일 안의 판매만 수정할 수 있습니다.");
        }
        if (newTotal < 0 || newTotal > MAX_QUANTITY) throw new RuntimeException("수량이 올바르지 않습니다.");
    }

    private Menu storeMenu(Long storeId, Long menuId) {
        return menuRepository.findByStoreId(storeId).stream().filter(m -> m.getId().equals(menuId)).findFirst()
                .orElseThrow(() -> new RuntimeException("이 가맹점의 메뉴가 아닙니다."));
    }

    private List<SalesData> rows(Long storeId, Long menuId, LocalDate date) {
        return salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, date, date).stream()
                .filter(s -> s.getMenu().getId().equals(menuId))
                .collect(Collectors.toList());
    }

    private List<SalesData> recentSales(Long storeId, LocalDate today) {
        return salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, today.minusDays(CONTEXT_DAYS - 1), today);
    }

    private static String shorten(String reason) {
        if (reason == null) return "-";
        return reason.length() > 100 ? reason.substring(0, 100) + "…" : reason;
    }
}
