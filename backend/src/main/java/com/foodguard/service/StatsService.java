package com.foodguard.service;

import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.Store;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(readOnly = true)
    public Map<String, Object> hq() {
        List<WasteRecord> wastes = wasteRecordRepository.findAll();
        List<OrderRequest> orders = orderRequestRepository.findAll();

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

        // 가맹점별 폐기 기록 건수·입고 대비 폐기율
        Map<Long, List<WasteRecord>> wasteByStore = wastes.stream().collect(Collectors.groupingBy(WasteRecord::getStoreId));
        Map<Long, List<OrderRequest>> ordersByStore = orders.stream().collect(Collectors.groupingBy(o -> o.getStore().getId()));
        List<Map<String, Object>> stores = new ArrayList<>();
        for (Store s : storeRepository.findAll()) {
            List<WasteRecord> w = wasteByStore.getOrDefault(s.getId(), List.of());
            if (w.isEmpty()) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("storeId", s.getId());
            item.put("storeName", s.getStoreName());
            item.put("wasteCount", w.size());
            item.put("wasteRate", wasteRate(w, ordersByStore.getOrDefault(s.getId(), List.of())));
            stores.add(item);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("monthly", monthlyList);
        result.put("stores", stores);
        result.put("recommendation", recommendationStats(orders));
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

    // 추천 적용률 = 추천 그대로 자동 발주(AUTO) 비율. 점주 직접 발주(MANUAL)는 추천 대비 수정 폭을 함께 본다 (Fildes et al. 2009)
    // order_source 가 생기기 전 발주(null)는 뺀다
    static Map<String, Object> recommendationStats(List<OrderRequest> orders) {
        List<OrderRequest> logged = orders.stream().filter(o -> o.getOrderSource() != null).toList();
        long auto = logged.stream().filter(o -> "AUTO".equals(o.getOrderSource())).count();
        List<OrderRequest> manual = logged.stream().filter(o -> "MANUAL".equals(o.getOrderSource())).toList();
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

    private static double round1(double v) {
        return Math.round(v * 10) / 10.0;
    }
}
