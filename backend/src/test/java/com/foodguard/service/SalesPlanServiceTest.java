package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.SalesTarget;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.SalesTargetRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// DB 없이 주간 매출 계획 계산만 검증: 지난 날은 실제 매출, 남은 날은 예측 매출
class SalesPlanServiceTest {

    private static final long STORE = 1L;
    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 26);
    private static final LocalDate WEDNESDAY = MONDAY.plusDays(2);

    private final SalesTargetRepository targetRepo = mock(SalesTargetRepository.class);
    private final SalesDataRepository salesRepo = mock(SalesDataRepository.class);
    private final PredictionResultRepository predictionRepo = mock(PredictionResultRepository.class);
    private final SalesPlanService service = new SalesPlanService(targetRepo, salesRepo, predictionRepo);

    private static Menu menu(int price) {
        Menu m = new Menu();
        m.setPrice(price);
        return m;
    }

    @Test
    void 지난_날은_실제_남은_날은_예측으로_주간_예상_매출을_목표와_비교한다() {
        SalesData mon = new SalesData();
        mon.setSaleDate(MONDAY);
        mon.setQuantity(10);
        mon.setMenu(menu(1000));
        SalesData tue = new SalesData();
        tue.setSaleDate(MONDAY.plusDays(1));
        tue.setQuantity(5);
        tue.setMenu(menu(2000));
        when(salesRepo.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(STORE, MONDAY, MONDAY.plusDays(6)))
                .thenReturn(List.of(mon, tue));

        List<PredictionResult> preds = new ArrayList<>();
        for (int d = 2; d <= 6; d++) {  // 수~일 하루 10개 × 1,000원
            PredictionResult p = new PredictionResult();
            p.setPredictionDate(MONDAY.plusDays(d));
            p.setPredictedQty(10);
            p.setMenu(menu(1000));
            preds.add(p);
        }
        when(predictionRepo.findByStoreIdAndPredictionDateBetween(STORE, MONDAY, MONDAY.plusDays(6))).thenReturn(preds);

        SalesTarget target = new SalesTarget();
        target.setTargetAmount(100_000L);
        when(targetRepo.findByStoreIdAndWeekStart(STORE, MONDAY)).thenReturn(Optional.of(target));

        Map<String, Object> plan = service.getPlan(STORE, WEDNESDAY, WEDNESDAY);

        assertThat(plan.get("weekStart")).isEqualTo("2026-10-26");
        assertThat(plan.get("actualToDate")).isEqualTo(20_000L);      // 월 10,000 + 화 10,000
        assertThat(plan.get("forecastRemaining")).isEqualTo(50_000L); // 수~일 10,000 × 5
        assertThat(plan.get("expectedTotal")).isEqualTo(70_000L);
        assertThat(plan.get("gap")).isEqualTo(-30_000L);
        assertThat(plan.get("achievementRate")).isEqualTo(70.0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> days = (List<Map<String, Object>>) plan.get("days");
        assertThat(days).extracting(d -> d.get("type"))
                .containsExactly("ACTUAL", "ACTUAL", "FORECAST", "FORECAST", "FORECAST", "FORECAST", "FORECAST");
    }

    @Test
    void 목표는_그_주_월요일로_저장되고_0이하는_거부한다() {
        when(targetRepo.findByStoreIdAndWeekStart(eq(STORE), any())).thenReturn(Optional.empty());
        when(targetRepo.save(any())).thenAnswer(a -> a.getArgument(0));

        assertThat(service.saveTarget(STORE, WEDNESDAY, 500_000L).getWeekStart()).isEqualTo(MONDAY);
        assertThatThrownBy(() -> service.saveTarget(STORE, WEDNESDAY, 0L)).hasMessageContaining("0보다");
    }
}
