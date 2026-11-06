package com.foodguard.service;

import com.foodguard.entity.DonationRecord;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.SalesDayFlag;
import com.foodguard.entity.Store;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.DonationRecordRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.SalesDayFlagRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

// 본사 통계 — 계획서 정량 목표(폐기율 절감, 추천 적용률)를 실제 기록(WASTE_RECORD, ORDER_REQUEST)으로 집계
@Service
@RequiredArgsConstructor
public class StatsService {

    private final SalesDataRepository salesDataRepository;
    private final WasteRecordRepository wasteRecordRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final DonationRecordRepository donationRecordRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final SalesDayFlagRepository salesDayFlagRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> hq() {
        List<WasteRecord> wastes = wasteRecordRepository.findAll();
        List<OrderRequest> orders = orderRequestRepository.findAll();
        // 기부 완료 = 폐기될 뻔한 식자재를 살린 기록
        List<DonationRecord> donations = donationRecordRepository.findAll().stream()
                .filter(d -> "COMPLETED".equals(d.getStatus())).toList();

        // 월별 매출 + 폐기 기록 건수
        Map<String, long[]> monthly = new TreeMap<>();
        for (Object[] row : salesDataRepository.sumRevenueByMonth()) {
            String month = String.format("%d-%02d", ((Number) row[0]).intValue(), ((Number) row[1]).intValue());
            monthly.computeIfAbsent(month, k -> new long[2])[0] = ((Number) row[2]).longValue();
        }
        for (WasteRecord w : wastes) {
            String month = String.format("%d-%02d", w.getWasteDate().getYear(), w.getWasteDate().getMonthValue());
            monthly.computeIfAbsent(month, k -> new long[2])[1]++;
        }
        List<Map<String, Object>> monthlyList = new ArrayList<>();
        monthly.forEach((month, v) -> monthlyList.add(Map.of("month", month, "revenue", v[0], "wasteCount", v[1])));

        // 가맹점별 폐기 기록 건수·입고 대비 폐기율·기부 완료 건수
        Map<Long, List<WasteRecord>> wasteByStore = wastes.stream().collect(Collectors.groupingBy(WasteRecord::getStoreId));
        Map<Long, Long> donationsByStore = donations.stream().collect(Collectors.groupingBy(DonationRecord::getStoreId, Collectors.counting()));
        Map<Long, List<OrderRequest>> ordersByStore = orders.stream().collect(Collectors.groupingBy(o -> o.getStore().getId()));
        List<Map<String, Object>> stores = new ArrayList<>();
        for (Store s : storeRepository.findAll()) {
            List<WasteRecord> w = wasteByStore.getOrDefault(s.getId(), List.of());
            long donated = donationsByStore.getOrDefault(s.getId(), 0L);
            if (w.isEmpty() && donated == 0) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("storeId", s.getId());
            item.put("storeName", s.getStoreName());
            item.put("wasteCount", w.size());
            item.put("wasteRate", wasteRate(w, ordersByStore.getOrDefault(s.getId(), List.of())));
            item.put("donationCount", donated);
            stores.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("monthly", monthlyList);
        result.put("stores", stores);
        result.put("recommendation", recommendationStats(orders));
        result.put("donationCount", donations.size());
        result.put("forecastAccuracy", forecastAccuracy(
                predictionResultRepository.findPastPredictions(LocalDate.now()),
                salesDataRepository.sumQuantityByDay(),
                salesDayFlagRepository.findAll()));
        return result;
    }

    // 입고 대비 폐기율(%) = 식자재마다 폐기량 / 입고 완료(DONE) 발주량의 평균. 식자재 단위가 kg·L·개로 섞여 있어 합이 아니라 비율 평균
    // 입고 기록이 있는 식자재만 센다. 하나도 없으면 null
    static Double wasteRate(List<WasteRecord> wastes, List<OrderRequest> orders) {
        Map<Long, Double> received = new HashMap<>();
        for (OrderRequest o : orders) {
            if ("DONE".equals(o.getStatus())) {
                received.merge(o.getIngredient().getId(), o.getOrderedQty().doubleValue(), Double::sum);
            }
        }
        Map<Long, Double> wasted = new HashMap<>();
        for (WasteRecord w : wastes) {
            wasted.merge(w.getIngredientId(), w.getQuantity().doubleValue(), Double::sum);
        }
        double[] rates = wasted.entrySet().stream()
                .filter(e -> received.getOrDefault(e.getKey(), 0.0) > 0)
                .mapToDouble(e -> e.getValue() / received.get(e.getKey()) * 100)
                .toArray();
        return rates.length == 0 ? null : round1(Arrays.stream(rates).average().orElse(0));
    }

    // 추천 적용률 = 추천 그대로 발주한 비율 (AUTO + 발주 참모에서 수량을 안 고친 AGENT). 나머지는 추천 대비 수정 폭을 함께 본다 (Fildes et al. 2009)
    // order_source 가 생기기 전 발주(null)는 뺀다
    static Map<String, Object> recommendationStats(List<OrderRequest> orders) {
        List<OrderRequest> logged = orders.stream().filter(o -> o.getOrderSource() != null).toList();
        long auto = logged.stream().filter(StatsService::followedRecommendation).count();
        List<OrderRequest> manual = logged.stream().filter(o -> !followedRecommendation(o)).toList();
        // 추천이 있던 식자재의 수동 발주: (발주량 − 추천량) / 추천량
        double[] changes = manual.stream()
                .filter(o -> o.getRecommendedQty() != null && o.getRecommendedQty().doubleValue() > 0)
                .mapToDouble(o -> (o.getOrderedQty().doubleValue() / o.getRecommendedQty().doubleValue() - 1) * 100)
                .toArray();

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("totalOrders", logged.size());
        r.put("autoOrders", auto);
        r.put("manualOrders", manual.size());
        r.put("adoptionRate", logged.isEmpty() ? null : round1(auto * 100.0 / logged.size()));
        r.put("manualWithRecommendation", changes.length);
        r.put("manualAvgChangePct", changes.length == 0 ? null : round1(Arrays.stream(changes).average().orElse(0)));
        r.put("manualWithoutRecommendation", manual.size() - changes.length);
        return r;
    }

    private static boolean followedRecommendation(OrderRequest o) {
        if ("AUTO".equals(o.getOrderSource())) return true;
        return "AGENT".equals(o.getOrderSource()) && o.getRecommendedQty() != null
                && o.getOrderedQty().compareTo(o.getRecommendedQty()) == 0;
    }

    // 운영 예측 정확도 = 저장된 예측 vs 실제 판매 (계획서 목표: 메뉴별 주간 ±10%). 백테스트가 아니라 실제로 내보낸 예측을 잰다
    // 그 매장 판매 입력이 있는 날만 비교하고, 휴무일·그 메뉴 품절일은 뺀다. 7일 모두 비교된 주만 주간 지표에 넣는다
    static Map<String, Object> forecastAccuracy(List<Object[]> predictions, List<Object[]> sales, List<SalesDayFlag> flags) {
        Map<String, Double> actual = new HashMap<>();
        Set<String> enteredDays = new HashSet<>();
        for (Object[] s : sales) {
            actual.put(s[0] + "/" + s[1] + "/" + s[2], ((Number) s[3]).doubleValue());
            enteredDays.add(s[0] + "/" + s[2]);
        }
        Set<String> excluded = new HashSet<>();
        for (SalesDayFlag f : flags) {
            excluded.add("SOLD_OUT".equals(f.getFlagType())
                    ? f.getStoreId() + "/" + f.getMenuId() + "/" + f.getFlagDate()
                    : f.getStoreId() + "/" + f.getFlagDate());
        }

        double errorSum = 0, actualSum = 0;
        int days = 0;
        Map<String, double[]> weeks = new HashMap<>();  // 매장/메뉴/주 -> [예측 합, 실제 합, 일수]
        for (Object[] p : predictions) {
            LocalDate date = (LocalDate) p[2];
            String dayKey = p[0] + "/" + date;
            String menuDayKey = p[0] + "/" + p[1] + "/" + date;
            if (!enteredDays.contains(dayKey) || excluded.contains(dayKey) || excluded.contains(menuDayKey)) continue;
            double predicted = ((Number) p[3]).doubleValue();
            double sold = actual.getOrDefault(menuDayKey, 0.0);  // 입력이 있는 영업일에 없는 메뉴 = 판매 0
            errorSum += Math.abs(predicted - sold);
            actualSum += sold;
            days++;
            String week = date.get(WeekFields.ISO.weekBasedYear()) + "-" + date.get(WeekFields.ISO.weekOfWeekBasedYear());
            double[] w = weeks.computeIfAbsent(p[0] + "/" + p[1] + "/" + week, k -> new double[3]);
            w[0] += predicted;
            w[1] += sold;
            w[2]++;
        }
        List<double[]> fullWeeks = weeks.values().stream().filter(w -> w[2] == 7).toList();
        long within = fullWeeks.stream().filter(w -> w[1] > 0 && Math.abs(w[0] - w[1]) / w[1] <= 0.1).count();

        Map<String, Object> r = new LinkedHashMap<>();
        r.put("evaluatedDays", days);
        r.put("wmape", actualSum == 0 ? null : round1(errorSum / actualSum * 100));
        r.put("menuWeeks", fullWeeks.size());
        r.put("weeklyWithin10Pct", fullWeeks.isEmpty() ? null : round1(within * 100.0 / fullWeeks.size()));
        return r;
    }

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
