package com.foodguard.service;

import com.foodguard.entity.Inventory;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;

    // 매출 등록
    public SalesData create(Long storeId, Long menuId,
                            Integer quantity, Integer totalPrice, LocalDate saleDate) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        SalesData sales = new SalesData();
        sales.setStore(store);
        sales.setMenu(menu);
        sales.setQuantity(quantity);
        sales.setTotalPrice(totalPrice);
        sales.setSaleDate(saleDate);
        SalesData saved = salesDataRepository.save(sales);

        // 매출 발생 → 레시피 기반 식자재 소모량 자동 차감
        deductIngredients(store, menu.getId(), quantity);
        return saved;
    }

    // 레시피(MenuIngredient) × 판매수량 × (1 + 오차범위%) 만큼 재고에서 차감
    private void deductIngredients(Store store, Long menuId, int saleQty) {
        for (MenuIngredient mi : menuIngredientRepository.findByMenuId(menuId)) {
            double tol = mi.getTolerance() != null ? mi.getTolerance().doubleValue() : 0.0;
            double consumeRecipeUnit = mi.getQtyPerUnit().doubleValue() * saleQty * (1.0 + tol / 100.0);
            String baseUnit = mi.getIngredient().getUnit();   // kg / L / 개
            double consumeBase = UnitConverter.toBaseUnit(consumeRecipeUnit, mi.getUnit(), baseUnit);

            Inventory inv = inventoryRepository
                    .findByStoreIdAndIngredientId(store.getId(), mi.getIngredient().getId())
                    .orElseGet(() -> {
                        Inventory n = new Inventory();
                        n.setStore(store);
                        n.setIngredient(mi.getIngredient());
                        n.setQuantity(0.0);
                        n.setMinThreshold(BigDecimal.ZERO);
                        n.setUnit(baseUnit);
                        return n;
                    });
            double next = round2(inv.getCurrentQty().doubleValue() - consumeBase); // 부족 시 음수 허용(부족분 표시)
            inv.setQuantity(next);
            inv.setUnit(baseUnit);
            inv.setUpdatedAt(LocalDateTime.now());
            inventoryRepository.save(inv);
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

    public Map<String, Object> getTodaySummary(Long storeId) {
        LocalDate today = LocalDate.now();
        long revenue = salesDataRepository.sumRevenueByDate(storeId, today);
        long qty = salesDataRepository.sumQtyByDate(storeId, today);
        long yesterdayRevenue = salesDataRepository.sumRevenueByDate(storeId, today.minusDays(1));
        String trend = revenue >= yesterdayRevenue ? "up" : "down";
        double changeRate = yesterdayRevenue > 0 ? Math.round((revenue - yesterdayRevenue) * 1000.0 / yesterdayRevenue) / 10.0 : 0;
        return Map.of("revenue", revenue, "qty", qty, "trend", trend, "changeRate", changeRate);
    }

    public Map<String, Object> getWeeklySummary(Long storeId) {
        LocalDate today = LocalDate.now();
        long thisWeek = salesDataRepository.sumRevenueBetween(storeId, today.minusDays(6), today);
        long prevWeek = salesDataRepository.sumRevenueBetween(storeId, today.minusDays(13), today.minusDays(7));
        return Map.of("thisWeekRevenue", thisWeek, "prevWeekRevenue", prevWeek);
    }

    public Map<Long, Long> getAllStoreWeeklySummary() {
        LocalDate today = LocalDate.now();
        List<Object[]> rows = salesDataRepository.sumRevenueAllStoresBetween(today.minusDays(6), today);
        Map<Long, Long> result = new java.util.LinkedHashMap<>();
        for (Object[] row : rows) {
            result.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return result;
    }

    // Soft Delete (실제 삭제 X, 삭제 표시만)
    public String delete(Long id) {
        SalesData sales = salesDataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("매출 데이터를 찾을 수 없습니다."));
        sales.setIsDeleted(true);
        sales.setDeletedAt(LocalDateTime.now());
        salesDataRepository.save(sales);
        return "매출 데이터 삭제 완료";
    }
}