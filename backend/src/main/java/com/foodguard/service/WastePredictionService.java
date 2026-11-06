package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.InventoryLot;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.SalesData;
import com.foodguard.repository.InventoryLotRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.util.UnitConverter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 폐기 위험 결정적 산식 (DEV_ROADMAP AG-2). 화면과 에이전트가 같은 결과를 쓴다.
 *
 * 앞으로 7일(오늘 포함)의 식자재 소모를 유통기한 이른 로트부터 배정하고, 기한까지 다 못 쓰는 양을 폐기 예측량으로 본다.
 * 소모량은 판매 차감(SalesDataService)과 같게 레시피 × 수량 × (1 + 오차범위%) 로 계산한다.
 * 7일 뒤에 만료되는 로트는 이 기간에 폐기되지 않으므로 폐기량이 0 이다 (보관일수가 긴 장류가 고위험으로 오판되는 것 방지).
 */
@Service
@RequiredArgsConstructor
public class WastePredictionService {

    static final int HORIZON_DAYS = 7;
    static final int FALLBACK_SALES_DAYS = 14;

    private final InventoryRepository inventoryRepository;
    private final InventoryLotRepository lotRepository;
    private final PredictionResultRepository predictionRepository;
    private final SalesDataRepository salesRepository;
    private final MenuIngredientRepository menuIngredientRepository;

    /** 로트별 배정 결과의 식자재 합계. expiryDate 는 폐기가 나는 가장 이른 로트, 없으면 가장 이른 로트의 기한. */
    record Assessment(double expectedConsumption, double wastePrediction, double expiredQty, LocalDate expiryDate) {}

    public record Report(List<Map<String, Object>> rows, String basis, List<String> warnings) {}

    /** lots 는 유통기한 있는 로트만 FIFO 순으로, dailyDemand[0] 은 오늘 소모량. */
    static Assessment assess(List<InventoryLot> lots, double[] dailyDemand, LocalDate today) {
        double used = 0, consumption = 0, waste = 0, expired = 0;
        LocalDate riskExpiry = null;
        for (InventoryLot lot : lots) {
            long daysLeft = ChronoUnit.DAYS.between(today, lot.getExpiryDate());
            double remaining = lot.getRemainingQty().doubleValue();
            double cons = Math.min(remaining, Math.max(0, demandThrough(dailyDemand, daysLeft) - used));
            used += cons;
            consumption += cons;
            if (daysLeft < 0) expired += remaining;
            if (daysLeft <= HORIZON_DAYS && remaining - cons > 0) {
                waste += remaining - cons;
                if (riskExpiry == null) riskExpiry = lot.getExpiryDate();
            }
        }
        return new Assessment(consumption, waste, expired, riskExpiry != null ? riskExpiry : lots.get(0).getExpiryDate());
    }

    private static double demandThrough(double[] dailyDemand, long daysLeft) {
        double sum = 0;
        for (int d = 0; d < Math.min(Math.max(daysLeft, 0), dailyDemand.length); d++) sum += dailyDemand[d];
        return sum;
    }

    static String riskLevel(long daysUntilExpiry, double wasteRatio) {
        if (daysUntilExpiry <= 2 && wasteRatio >= 0.3) return "HIGH";
        return wasteRatio >= 0.15 ? "MEDIUM" : "LOW";
    }

    /** 위험이 높은 순 → 기한이 이른 순. wasteRate 는 화면 표시 그대로 퍼센트(0~100)다. */
    @Transactional(readOnly = true)
    public Report predict(Long storeId) {
        LocalDate today = LocalDate.now();
        List<String> warnings = new ArrayList<>();

        Map<LocalDate, Map<Long, Double>> menuQtyByDate = new HashMap<>();
        for (PredictionResult p : predictionRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today)) {
            menuQtyByDate.computeIfAbsent(p.getPredictionDate(), d -> new HashMap<>())
                    .merge(p.getMenu().getId(), p.getPredictedQty().doubleValue(), Double::sum);
        }

        // 예측이 없는 날은 최근 판매 평균으로 채운다
        Map<Long, Double> fallback = null;
        boolean usedFallback = false;
        List<Map<Long, Double>> menuQtyPerDay = new ArrayList<>();
        for (int d = 0; d < HORIZON_DAYS; d++) {
            Map<Long, Double> day = menuQtyByDate.get(today.plusDays(d));
            if (day == null) {
                if (fallback == null) fallback = recentDailyAverage(storeId, today);
                usedFallback = true;
                day = fallback;
            }
            menuQtyPerDay.add(day);
        }
        if (fallback != null && fallback.isEmpty()) {
            warnings.add("예측이 없는 날이 있고 최근 " + FALLBACK_SALES_DAYS + "일 판매도 없어 그날 소모를 0 으로 계산했습니다.");
        }

        Map<Long, double[]> demand = ingredientDemand(menuQtyPerDay, warnings);

        Map<Long, List<InventoryLot>> lotsByIngredient = new HashMap<>();
        for (InventoryLot lot : lotRepository.findOpenByStore(storeId)) {
            if (lot.getExpiryDate() != null) {
                lotsByIngredient.computeIfAbsent(lot.getIngredientId(), k -> new ArrayList<>()).add(lot);
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            List<InventoryLot> lots = lotsByIngredient.get(inv.getIngredient().getId());
            if (lots == null) continue;
            rows.add(toRow(inv, assess(lots, demand.getOrDefault(inv.getIngredient().getId(), new double[HORIZON_DAYS]), today), today));
        }
        rows.sort((a, b) -> {
            int byRisk = Integer.compare(riskOrder(a), riskOrder(b));
            return byRisk != 0 ? byRisk : Long.compare((Long) a.get("daysUntilExpiry"), (Long) b.get("daysUntilExpiry"));
        });
        String basis = usedFallback ? "fallback_avg" : "prediction";
        rows.forEach(r -> r.put("basis", basis));
        return new Report(rows, basis, warnings);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long storeId) {
        Report report = predict(storeId);
        long high = report.rows().stream().filter(r -> "HIGH".equals(r.get("riskLevel"))).count();
        long medium = report.rows().stream().filter(r -> "MEDIUM".equals(r.get("riskLevel"))).count();
        double wasteKg = report.rows().stream().filter(r -> "kg".equals(r.get("unit")))
                .mapToDouble(r -> (Double) r.get("wastePrediction")).sum();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalItems", report.rows().size());
        m.put("highRisk", high);
        m.put("mediumRisk", medium);
        m.put("expectedWasteKg", round2(wasteKg));
        m.put("expectedWasteValue", null);  // 식자재 원가 데이터가 아직 없다
        m.put("basis", report.basis());
        m.put("warnings", report.warnings());
        return m;
    }

    private Map<Long, Double> recentDailyAverage(Long storeId, LocalDate today) {
        Map<Long, Double> avg = new HashMap<>();
        for (SalesData s : salesRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(
                storeId, today.minusDays(FALLBACK_SALES_DAYS), today.minusDays(1))) {
            avg.merge(s.getMenu().getId(), s.getQuantity() / (double) FALLBACK_SALES_DAYS, Double::sum);
        }
        return avg;
    }

    /** 메뉴별 일자 수량 → 식자재별 일자 소모량 (기준 단위). 레시피 없는 메뉴·비호환 단위는 소모 0 + 경고. */
    private Map<Long, double[]> ingredientDemand(List<Map<Long, Double>> menuQtyPerDay, List<String> warnings) {
        Set<Long> menuIds = new LinkedHashSet<>();
        menuQtyPerDay.forEach(day -> menuIds.addAll(day.keySet()));

        Map<Long, double[]> demand = new HashMap<>();
        Set<Long> reportedUnits = new HashSet<>();
        for (Long menuId : menuIds) {
            List<MenuIngredient> recipe = menuIngredientRepository.findByMenuId(menuId);
            if (recipe.isEmpty()) warnings.add("메뉴 " + menuId + " 는 레시피가 없어 소모량에 반영되지 않았습니다.");
            for (MenuIngredient mi : recipe) {
                Long ingId = mi.getIngredient().getId();
                String baseUnit = mi.getIngredient().getUnit();
                if (!UnitConverter.isCompatible(mi.getUnit(), baseUnit)) {
                    if (reportedUnits.add(ingId)) {
                        warnings.add(mi.getIngredient().getName() + ": 레시피 " + mi.getUnit() + " ↔ 식자재 " + baseUnit
                                + " 비호환이라 소모량에서 뺐습니다.");
                    }
                    continue;
                }
                double tol = mi.getTolerance() != null ? mi.getTolerance().doubleValue() : 0.0;
                double perMenu = UnitConverter.toBaseUnit(
                        mi.getQtyPerUnit().doubleValue() * (1.0 + tol / 100.0), mi.getUnit(), baseUnit);
                double[] days = demand.computeIfAbsent(ingId, k -> new double[HORIZON_DAYS]);
                for (int d = 0; d < HORIZON_DAYS; d++) {
                    days[d] += perMenu * menuQtyPerDay.get(d).getOrDefault(menuId, 0.0);
                }
            }
        }
        return demand;
    }

    private static Map<String, Object> toRow(Inventory inv, Assessment a, LocalDate today) {
        double current = inv.getCurrentQty().doubleValue();
        double ratio = current > 0 ? a.wastePrediction() / current : 0.0;
        long days = ChronoUnit.DAYS.between(today, a.expiryDate());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("inventoryId", inv.getId());
        m.put("ingredientId", inv.getIngredient().getId());
        m.put("ingredientName", inv.getIngredient().getName());
        m.put("category", inv.getIngredient().getCategory());
        m.put("unit", inv.getUnit());
        m.put("currentQty", current);
        m.put("expiryDate", a.expiryDate());
        m.put("daysUntilExpiry", days);
        m.put("expectedConsumption", round2(a.expectedConsumption()));
        m.put("wastePrediction", round2(a.wastePrediction()));
        m.put("expiredQty", round2(a.expiredQty()));
        m.put("wasteRate", round2(ratio * 100));
        m.put("riskLevel", riskLevel(days, ratio));
        return m;
    }

    private static int riskOrder(Map<String, Object> row) {
        return switch ((String) row.get("riskLevel")) {
            case "HIGH" -> 0;
            case "MEDIUM" -> 1;
            default -> 2;
        };
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
