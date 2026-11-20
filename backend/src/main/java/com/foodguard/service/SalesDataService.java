package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.util.UnitConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.TreeMap;
import java.util.ArrayList;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    static final int MAX_SUMMARY_DAYS = 366;

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryLedger ledger;

    // 매출 등록
    @Transactional
    public SalesData create(Long storeId, Long menuId, Integer quantity, LocalDate saleDate) {
        if (quantity == null || quantity <= 0) throw new RuntimeException("판매 수량은 1 이상이어야 합니다.");
        if (saleDate.isAfter(LocalDate.now())) throw new RuntimeException("미래 날짜의 판매는 등록할 수 없습니다.");
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        SalesData sales = new SalesData();
        sales.setStore(store);
        sales.setMenu(menu);
        sales.setQuantity(quantity);
        sales.setSaleDate(saleDate);
        SalesData saved = salesDataRepository.save(sales);

        // 매출 발생 → 레시피 기반 식자재 소모량 자동 차감
        deductIngredients(store, menu.getId(), quantity, saved.getId());
        return saved;
    }

    // 레시피(MenuIngredient) × 판매수량 × (1 + 오차범위%) 만큼 재고에서 차감
    private void deductIngredients(Store store, Long menuId, int saleQty, Long salesId) {
        for (MenuIngredient mi : menuIngredientRepository.findByMenuId(menuId)) {
            double tol = mi.getTolerance() != null ? mi.getTolerance().doubleValue() : 0.0;
            double consumeRecipeUnit = mi.getQtyPerUnit().doubleValue() * saleQty * (1.0 + tol / 100.0);
            String baseUnit = mi.getIngredient().getUnit();   // kg / L / 개
            double consumeBase = UnitConverter.toBaseUnit(consumeRecipeUnit, mi.getUnit(), baseUnit);

            double cur = inventoryRepository
                    .findByStoreIdAndIngredientId(store.getId(), mi.getIngredient().getId())
                    .map(i -> i.getCurrentQty().doubleValue())
                    .orElse(0.0);
            double next = round2(cur - consumeBase); // 부족 시 음수 허용(부족분 표시)
            ledger.set(store, mi.getIngredient(), next, "SALE", "SALES_DATA", salesId);
        }
    }

    private double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    // 가맹점 매출 조회 (삭제 안 된 것만)
    public List<SalesData> getByStore(Long storeId) {
        return salesDataRepository.findByStoreIdAndIsDeletedFalse(storeId);
    }

    // 기간별 매출 조회
    public List<SalesData> getByDateRange(Long storeId, LocalDate start, LocalDate end) {
        return salesDataRepository
                .findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, start, end);
    }

    // 대시보드 KPI: 오늘·어제 판매 수량과 매출(할인 판매는 실제 판매가, 본사 통계와 같은 계산). 판매가 없는 날은 0
    public Map<String, Object> getTodaySummary(Long storeId) {
        LocalDate today = LocalDate.now();
        Map<LocalDate, long[]> byDay = new HashMap<>();
        for (Object[] row : salesDataRepository.sumDailyByStoreBetween(storeId, today.minusDays(1), today)) {
            byDay.put((LocalDate) row[0], new long[]{((Number) row[1]).longValue(), ((Number) row[2]).longValue()});
        }
        long[] t = byDay.getOrDefault(today, new long[2]);
        long[] y = byDay.getOrDefault(today.minusDays(1), new long[2]);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("date", today.toString());
        result.put("quantity", t[0]);
        result.put("revenue", t[1]);
        result.put("prevQuantity", y[0]);
        result.put("prevRevenue", y[1]);
        return result;
    }

    // 판매량 집계 + 직전 같은 길이 기간과 비교. 숫자는 여기서만 계산한다 (AI 요약은 이 값을 문장으로만 쓴다)
    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long storeId, LocalDate start, LocalDate end) {
        if (end.isBefore(start)) throw new RuntimeException("종료일이 시작일보다 빠릅니다.");
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days > MAX_SUMMARY_DAYS) throw new RuntimeException("판매량은 " + MAX_SUMMARY_DAYS + "일까지 조회할 수 있습니다.");
        return summarize(start, end,
                salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, start, end),
                salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, start.minusDays(days), start.minusDays(1)));
    }

    static Map<String, Object> summarize(LocalDate start, LocalDate end, List<SalesData> sales, List<SalesData> previous) {
        long quantity = 0, revenue = 0, discountQuantity = 0, discountAmount = 0;
        Map<Long, Map<String, Object>> byMenu = new LinkedHashMap<>();
        Map<LocalDate, long[]> byDay = new TreeMap<>();
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) byDay.put(d, new long[2]);

        for (SalesData s : sales) {
            int listPrice = s.getMenu().getPrice();
            int price = s.getUnitPrice() != null ? s.getUnitPrice() : listPrice;
            long amount = (long) price * s.getQuantity();
            boolean discounted = s.getDiscountPct() != null && s.getDiscountPct() > 0;
            quantity += s.getQuantity();
            revenue += amount;
            if (discounted) {
                discountQuantity += s.getQuantity();
                discountAmount += (long) (listPrice - price) * s.getQuantity();
            }
            long[] day = byDay.get(s.getSaleDate());
            day[0] += s.getQuantity();
            day[1] += amount;
            Map<String, Object> menu = byMenu.computeIfAbsent(s.getMenu().getId(), id -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("menuId", id);
                m.put("menuName", s.getMenu().getMenuName());
                m.put("quantity", 0L);
                m.put("revenue", 0L);
                m.put("discountQuantity", 0L);
                return m;
            });
            menu.merge("quantity", (long) s.getQuantity(), (a, b) -> (Long) a + (Long) b);
            menu.merge("revenue", amount, (a, b) -> (Long) a + (Long) b);
            if (discounted) menu.merge("discountQuantity", (long) s.getQuantity(), (a, b) -> (Long) a + (Long) b);
        }
        long previousQuantity = 0, previousRevenue = 0;
        for (SalesData s : previous) {
            previousQuantity += s.getQuantity();
            previousRevenue += (long) (s.getUnitPrice() != null ? s.getUnitPrice() : s.getMenu().getPrice()) * s.getQuantity();
        }

        List<Map<String, Object>> menus = new ArrayList<>(byMenu.values());
        menus.sort((a, b) -> Long.compare((Long) b.get("quantity"), (Long) a.get("quantity")));
        List<Map<String, Object>> daily = new ArrayList<>();
        byDay.forEach((d, v) -> daily.add(Map.of("date", d.toString(), "quantity", v[0], "revenue", v[1])));

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("start", start.toString());
        r.put("end", end.toString());
        r.put("totalQuantity", quantity);
        r.put("revenue", revenue);
        r.put("discountQuantity", discountQuantity);
        r.put("discountAmount", discountAmount);
        r.put("previousQuantity", previousQuantity);
        r.put("previousRevenue", previousRevenue);
        r.put("byMenu", menus);
        r.put("byDay", daily);
        return r;
    }

    // 전 가맹점 최근 7일 매출 {storeId: 매출액} (본사 대시보드)
    public Map<Long, Long> getAllStoreWeeklySummary() {
        LocalDate today = LocalDate.now();
        Map<Long, Long> result = new LinkedHashMap<>();
        for (Object[] row : salesDataRepository.sumRevenueAllStoresBetween(today.minusDays(6), today)) {
            result.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return result;
    }

    // 판매 삭제 (기록은 남기고 is_deleted 표시)
    @Transactional
    public String delete(Long id) {
        SalesData sales = salesDataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("매출 데이터를 찾을 수 없습니다."));
        sales.setIsDeleted(true);
        salesDataRepository.save(sales);
        return "매출 데이터 삭제 완료";
    }

    // 최근 7일 vs 직전 7일 매출
    public Map<String, Object> getWeeklySummary(Long storeId) {
        LocalDate today = LocalDate.now();
        long thisWeek = revenueBetween(storeId, today.minusDays(6), today);
        long prevWeek = revenueBetween(storeId, today.minusDays(13), today.minusDays(7));
        return Map.of("thisWeekRevenue", thisWeek, "prevWeekRevenue", prevWeek);
    }

    // 기간 매출 합계 (할인 판매는 실제 판매가, getTodaySummary 와 같은 계산)
    private long revenueBetween(Long storeId, LocalDate from, LocalDate to) {
        long sum = 0;
        for (Object[] row : salesDataRepository.sumDailyByStoreBetween(storeId, from, to)) {
            sum += ((Number) row[2]).longValue();
        }
        return sum;
    }
}
