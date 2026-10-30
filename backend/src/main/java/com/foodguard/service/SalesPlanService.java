package com.foodguard.service;

import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.SalesTarget;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.SalesTargetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

/**
 * 매출 계획 수립 지원 (계획서 결과물 3): 주간 목표 매출 vs 예상 매출.
 * 예상 매출 = 지난 날의 실제 매출 + 남은 날의 AI 예측 매출(예측 판매량 × 메뉴 가격)
 */
@Service
@RequiredArgsConstructor
public class SalesPlanService {

    private final SalesTargetRepository salesTargetRepository;
    private final SalesDataRepository salesDataRepository;
    private final PredictionResultRepository predictionResultRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getPlan(Long storeId, LocalDate anyDayOfWeek, LocalDate today) {
        LocalDate weekStart = anyDayOfWeek.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(6);

        Map<LocalDate, Long> actual = new HashMap<>();
        for (SalesData s : salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, weekStart, weekEnd)) {
            actual.merge(s.getSaleDate(), (long) s.getQuantity() * s.getMenu().getPrice(), Long::sum);
        }
        Map<LocalDate, Long> forecast = new HashMap<>();
        for (PredictionResult p : predictionResultRepository.findByStoreIdAndPredictionDateBetween(storeId, weekStart, weekEnd)) {
            forecast.merge(p.getPredictionDate(), (long) p.getPredictedQty() * p.getMenu().getPrice(), Long::sum);
        }

        // 오늘 전은 실제 매출, 오늘부터는 예측 매출 (예측이 없는 날은 NONE)
        long actualToDate = 0;
        long forecastRemaining = 0;
        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate d = weekStart; !d.isAfter(weekEnd); d = d.plusDays(1)) {
            String type;
            long amount;
            if (d.isBefore(today)) {
                type = "ACTUAL";
                amount = actual.getOrDefault(d, 0L);
                actualToDate += amount;
            } else if (forecast.containsKey(d)) {
                type = "FORECAST";
                amount = forecast.get(d);
                forecastRemaining += amount;
            } else {
                type = "NONE";
                amount = 0;
            }
            days.add(Map.of("date", d.toString(), "type", type, "amount", amount));
        }

        Long target = salesTargetRepository.findByStoreIdAndWeekStart(storeId, weekStart)
                .map(SalesTarget::getTargetAmount).orElse(null);
        long expected = actualToDate + forecastRemaining;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("weekStart", weekStart.toString());
        result.put("targetAmount", target);
        result.put("actualToDate", actualToDate);
        result.put("forecastRemaining", forecastRemaining);
        result.put("expectedTotal", expected);
        result.put("gap", target != null ? expected - target : null);
        result.put("achievementRate", target != null && target > 0 ? Math.round(expected * 1000.0 / target) / 10.0 : null);
        result.put("days", days);
        return result;
    }

    // 같은 주 목표가 있으면 덮어쓴다
    @Transactional
    public SalesTarget saveTarget(Long storeId, LocalDate anyDayOfWeek, long targetAmount) {
        if (targetAmount <= 0) {
            throw new RuntimeException("목표 매출은 0보다 커야 합니다.");
        }
        LocalDate weekStart = anyDayOfWeek.with(DayOfWeek.MONDAY);
        SalesTarget target = salesTargetRepository.findByStoreIdAndWeekStart(storeId, weekStart)
                .orElseGet(SalesTarget::new);
        target.setStoreId(storeId);
        target.setWeekStart(weekStart);
        target.setTargetAmount(targetAmount);
        return salesTargetRepository.save(target);
    }
}
