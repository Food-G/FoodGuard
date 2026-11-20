package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import com.foodguard.util.UnitUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 유통기한 임박 식자재 소진: 후보 계산 → 점주가 메뉴별 할인율 입력 → POS 결제가 할인가로 판매 기록·재고 차감.
 * 할인율은 점주가 정한다. 탄력성 데이터가 없어 시스템이 할인율을 추천하지 않는다.
 */
@Service
@RequiredArgsConstructor
public class DiscountService {

    static final int CANDIDATE_DAYS = 7;
    static final int MAX_DISCOUNT_PCT = 90;
    static final int MAX_DURATION_DAYS = 30;
    // 원가를 판매가의 40% 로 근사 (AI 서비스 COST_RATIO). 이보다 크게 할인하면 원가 밑으로 판다
    static final int BELOW_COST_PCT = 60;

    private final MenuDiscountRepository menuDiscountRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final DonationRecordRepository donationRecordRepository;
    private final SalesDataRepository salesDataRepository;
    private final AiClient aiClient;

    static int discountedPrice(int price, int pct) {
        return (int) Math.round(price * (100 - pct) / 1000.0) * 10;  // 10원 단위
    }

    // 후보: 7일 안에 기한이 끝나는 재고 중 예측 사용량·기부 예정을 빼도 남는 식자재. 예측이 없으면 재고 전체를 남는 양으로 본다
    @Transactional(readOnly = true)
    public List<Map<String, Object>> candidates(Long storeId) {
        LocalDate today = LocalDate.now();
        List<PredictionResult> predictions = predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today);
        Map<Long, Double> planned = DonationService.plannedByIngredient(donationRecordRepository.findByStoreIdAndStatus(storeId, "PLANNED"));
        Map<Long, MenuDiscount> active = menuDiscountRepository.findActiveOn(storeId, today).stream()
                .collect(Collectors.toMap(MenuDiscount::getMenuId, Function.identity(), (a, b) -> b));
        Map<Long, List<MenuIngredient>> recipes = new HashMap<>();
        List<Menu> menus = menuRepository.findByStoreIdAndIsActiveTrue(storeId);
        for (Menu m : menus) recipes.put(m.getId(), menuIngredientRepository.findByMenuId(m.getId()));

        List<Map<String, Object>> out = new ArrayList<>();
        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            LocalDate expiry = inv.getExpiryDate();
            double stock = inv.getCurrentQty().doubleValue();
            if (expiry == null || stock <= 0 || expiry.isBefore(today) || expiry.isAfter(today.plusDays(CANDIDATE_DAYS))) continue;
            Ingredient ing = inv.getIngredient();

            double usage = 0;
            for (PredictionResult p : predictions) {
                if (p.getPredictionDate().isAfter(expiry)) continue;
                for (MenuIngredient mi : recipes.getOrDefault(p.getMenu().getId(), List.of())) {
                    if (mi.getIngredient().getId().equals(ing.getId())) {
                        usage += p.getPredictedQty() * perUnit(mi, ing);
                    }
                }
            }
            double surplus = UnitUtils.round1(stock - usage - planned.getOrDefault(ing.getId(), 0.0));
            if (surplus <= 0) continue;

            List<Map<String, Object>> menuItems = new ArrayList<>();
            for (Menu m : menus) {
                for (MenuIngredient mi : recipes.get(m.getId())) {
                    if (!mi.getIngredient().getId().equals(ing.getId()) || perUnit(mi, ing) <= 0) continue;
                    MenuDiscount d = active.get(m.getId());
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("menuId", m.getId());
                    item.put("menuName", m.getMenuName());
                    item.put("price", m.getPrice());
                    item.put("usagePerMenu", perUnit(mi, ing));
                    // 이 메뉴만으로 남는 양을 쓰려면 평소보다 더 팔아야 하는 개수
                    item.put("extraUnitsToClear", (long) Math.ceil(surplus / perUnit(mi, ing)));
                    item.put("activeDiscountPct", d == null ? null : d.getDiscountPct());
                    item.put("activeDiscountId", d == null ? null : d.getId());
                    item.put("activeEndDate", d == null ? null : d.getEndDate());
                    menuItems.add(item);
                }
            }
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("ingredientId", ing.getId());
            c.put("ingredientName", ing.getName());
            c.put("unit", inv.getUnit());
            c.put("stock", stock);
            c.put("expiryDate", expiry);
            c.put("daysLeft", ChronoUnit.DAYS.between(today, expiry));
            c.put("expectedUsage", UnitUtils.round1(usage));
            c.put("surplus", surplus);
            c.put("forecastAvailable", !predictions.isEmpty());
            c.put("menus", menuItems);
            out.add(c);
        }
        out.sort(Comparator.comparingLong(c -> (Long) c.get("daysLeft")));
        return out;
    }

    private static double perUnit(MenuIngredient mi, Ingredient ing) {
        return UnitUtils.convertToBaseUnit(mi.getQtyPerUnit().doubleValue(), mi.getUnit(), ing.getUnit());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> active(Long storeId) {
        Map<Long, Menu> menus = menuRepository.findByStoreId(storeId).stream().collect(Collectors.toMap(Menu::getId, Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (MenuDiscount d : menuDiscountRepository.findActiveOn(storeId, LocalDate.now())) {
            Menu m = menus.get(d.getMenuId());
            if (m == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", d.getId());
            item.put("menuId", d.getMenuId());
            item.put("menuName", m.getMenuName());
            item.put("price", m.getPrice());
            item.put("discountPct", d.getDiscountPct());
            item.put("discountedPrice", discountedPrice(m.getPrice(), d.getDiscountPct()));
            item.put("endDate", d.getEndDate());
            out.add(item);
        }
        return out;
    }

    // 메뉴마다 할인은 하나: 새로 걸면 이전 할인을 끝낸다
    @Transactional
    public Map<String, Object> apply(Long storeId, Long menuId, Long ingredientId, int pct, LocalDate endDate) {
        LocalDate today = LocalDate.now();
        if (pct < 1 || pct > MAX_DISCOUNT_PCT) throw new RuntimeException("할인율은 1~" + MAX_DISCOUNT_PCT + "% 로 입력해 주세요.");
        if (endDate.isBefore(today)) throw new RuntimeException("종료일은 오늘 이후여야 합니다.");
        if (endDate.isAfter(today.plusDays(MAX_DURATION_DAYS))) throw new RuntimeException("할인 기간은 " + MAX_DURATION_DAYS + "일까지 정할 수 있습니다.");
        Menu menu = menuRepository.findByStoreId(storeId).stream().filter(m -> m.getId().equals(menuId)).findFirst()
                .orElseThrow(() -> new RuntimeException("이 가맹점의 메뉴가 아닙니다."));

        menuDiscountRepository.findByStoreIdAndMenuIdAndActiveTrue(storeId, menuId).forEach(d -> d.setActive(false));
        MenuDiscount d = new MenuDiscount();
        d.setStoreId(storeId);
        d.setMenuId(menuId);
        d.setIngredientId(ingredientId);
        d.setDiscountPct(pct);
        d.setStartDate(today);
        d.setEndDate(endDate);
        menuDiscountRepository.save(d);

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("id", d.getId());
        r.put("discountedPrice", discountedPrice(menu.getPrice(), pct));
        r.put("belowCost", pct > BELOW_COST_PCT);
        return r;
    }

    @Transactional
    public void end(Long id) {
        menuDiscountRepository.findById(id).ifPresent(d -> d.setActive(false));
    }

    // AI 정리: 어떤 식자재·메뉴부터 볼지 문장으로. 숫자는 후보 계산값 그대로이고 할인율은 제안하지 않는다
    public Map<String, Object> briefing(Long storeId) {
        return aiClient.post("/api/agents/clearance", Map.of("candidates", candidates(storeId)));
    }

    /**
     * POS 결제: 가격은 서버가 오늘 할인으로 다시 계산하고(화면 값을 믿지 않음), 판매를 그 가격으로 기록한 뒤 레시피대로 재고를 줄인다.
     * 재고 행이 없는 식자재는 건너뛰고, 음수가 되면 그대로 두어 재고·데이터 점검이 알린다.
     */
    @Transactional
    public Map<String, Object> checkout(Long storeId, List<Map<String, Object>> items) {
        LocalDate today = LocalDate.now();
        if (items == null || items.isEmpty()) throw new RuntimeException("결제할 메뉴가 없습니다.");
        Map<Long, Menu> menus = menuRepository.findByStoreId(storeId).stream().collect(Collectors.toMap(Menu::getId, Function.identity()));
        Map<Long, Integer> discounts = menuDiscountRepository.findActiveOn(storeId, today).stream()
                .collect(Collectors.toMap(MenuDiscount::getMenuId, MenuDiscount::getDiscountPct, (a, b) -> b));

        long total = 0;
        List<Map<String, Object>> lines = new ArrayList<>();
        for (Map<String, Object> item : items) {
            Menu menu = menus.get(Long.valueOf(item.get("menuId").toString()));
            if (menu == null) throw new RuntimeException("이 가맹점의 메뉴가 아닙니다.");
            int quantity = Integer.parseInt(item.get("quantity").toString());
            if (quantity <= 0) throw new RuntimeException("수량은 1 이상이어야 합니다.");
            Integer pct = discounts.get(menu.getId());
            int unitPrice = pct == null ? menu.getPrice() : discountedPrice(menu.getPrice(), pct);

            SalesData sale = new SalesData();
            sale.setStore(menu.getStore());
            sale.setMenu(menu);
            sale.setQuantity(quantity);
            sale.setSaleDate(today);
            sale.setUnitPrice(unitPrice);
            sale.setDiscountPct(pct);
            salesDataRepository.save(sale);

            for (MenuIngredient mi : menuIngredientRepository.findByMenuId(menu.getId())) {
                inventoryRepository.findByStoreIdAndIngredientId(storeId, mi.getIngredient().getId()).ifPresent(inv -> {
                    double used = perUnit(mi, mi.getIngredient()) * quantity;
                    inv.setCurrentQty(inv.getCurrentQty().subtract(BigDecimal.valueOf(used)));
                });
            }
            total += (long) unitPrice * quantity;
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("menuId", menu.getId());
            line.put("menuName", menu.getMenuName());
            line.put("quantity", quantity);
            line.put("unitPrice", unitPrice);
            line.put("listPrice", menu.getPrice());
            line.put("discountPct", pct);
            lines.add(line);
        }
        return Map.of("total", total, "lines", lines);
    }
}
