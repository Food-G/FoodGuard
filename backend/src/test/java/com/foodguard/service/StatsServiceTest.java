package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.SalesDayFlag;
import com.foodguard.entity.WasteRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// DB 없이 본사 통계의 폐기율·추천 적용률 계산만 검증
class StatsServiceTest {

    @Test
    void 운영_정확도는_입력된_영업일만_비교하고_휴무일_품절일을_뺀다() {
        LocalDate monday = LocalDate.of(2026, 11, 2);
        List<Object[]> predictions = new ArrayList<>();
        List<Object[]> sales = new ArrayList<>();
        for (int i = 0; i < 7; i++) { // 메뉴 10: 7일 모두 예측 10, 실제 12 → 주간 오차 약 17%
            predictions.add(new Object[]{1L, 10L, monday.plusDays(i), 10});
            sales.add(new Object[]{1L, 10L, monday.plusDays(i), 12L});
        }
        predictions.add(new Object[]{1L, 11L, monday, 5});          // 입력 있는 날에 판매 없음 → 판매 0
        predictions.add(new Object[]{1L, 12L, monday, 100});        // 품절 → 제외
        predictions.add(new Object[]{1L, 10L, monday.plusDays(7), 50});  // 판매 입력이 없는 날 → 제외
        predictions.add(new Object[]{2L, 20L, monday, 100});        // 매장 2 휴무 → 제외
        sales.add(new Object[]{2L, 20L, monday, 1L});
        List<SalesDayFlag> flags = List.of(flag(1L, 12L, monday, "SOLD_OUT"), flag(2L, null, monday, "CLOSED"));

        Map<String, Object> r = StatsService.forecastAccuracy(predictions, sales, flags);

        assertThat(r.get("evaluatedDays")).isEqualTo(8);
        assertThat(r.get("wmape")).isEqualTo(22.6); // (2×7 + 5) / 84
        assertThat(r.get("menuWeeks")).isEqualTo(1);
        assertThat(r.get("weeklyWithin10Pct")).isEqualTo(0.0);
    }

    @Test
    void 비교할_예측이_없으면_정확도는_비어_있다() {
        Map<String, Object> r = StatsService.forecastAccuracy(List.of(), List.of(), List.of());
        assertThat(r.get("evaluatedDays")).isEqualTo(0);
        assertThat(r.get("wmape")).isNull();
        assertThat(r.get("weeklyWithin10Pct")).isNull();
    }

    private static SalesDayFlag flag(Long storeId, Long menuId, LocalDate date, String type) {
        SalesDayFlag f = new SalesDayFlag();
        f.setStoreId(storeId);
        f.setMenuId(menuId);
        f.setFlagDate(date);
        f.setFlagType(type);
        return f;
    }

    @Test
    void 폐기율은_식자재마다_입고_완료량_대비_폐기량의_평균이다() {
        List<OrderRequest> orders = List.of(
                order(1L, "DONE", "10", null, null),
                order(1L, "DONE", "10", null, null),
                order(2L, "DONE", "5", null, null),
                order(2L, "REQUESTED", "100", null, null)); // 아직 입고 안 됨 → 제외
        List<WasteRecord> wastes = List.of(waste(1L, "2"), waste(2L, "1"), waste(3L, "9")); // 식자재 3은 입고 기록 없음 → 제외

        // 식자재 1: 2 / 20 = 10%, 식자재 2: 1 / 5 = 20%
        assertThat(StatsService.wasteRate(wastes, orders)).isEqualTo(15.0);
        assertThat(StatsService.wasteRate(wastes, List.of())).isNull();
    }

    @Test
    void 추천_적용률은_기록된_발주_중_자동_발주_비율이다() {
        List<OrderRequest> orders = List.of(
                order(1L, "DONE", "10", "10", "AUTO"),
                order(1L, "DONE", "10", "10", "AUTO"),
                order(1L, "DONE", "10", "10", "AUTO"),
                order(2L, "DONE", "12", "10", "MANUAL"), // +20%
                order(3L, "DONE", "5", "0", "MANUAL"),   // 추천에 없던 식자재
                order(4L, "DONE", "5", null, null));      // 로그 생기기 전 발주 → 제외

        Map<String, Object> r = StatsService.recommendationStats(orders);

        assertThat(r).containsEntry("totalOrders", 5);
        assertThat(r).containsEntry("adoptionRate", 60.0);
        assertThat(r).containsEntry("manualAvgChangePct", 20.0);
        assertThat(r).containsEntry("manualWithoutRecommendation", 1);
    }

    private static OrderRequest order(Long ingredientId, String status, String qty, String recommended, String source) {
        Ingredient ing = new Ingredient();
        ing.setId(ingredientId);
        OrderRequest o = new OrderRequest();
        o.setIngredient(ing);
        o.setStatus(status);
        o.setOrderedQty(new BigDecimal(qty));
        o.setRecommendedQty(recommended != null ? new BigDecimal(recommended) : null);
        o.setOrderSource(source);
        return o;
    }

    private static WasteRecord waste(Long ingredientId, String qty) {
        WasteRecord w = new WasteRecord();
        w.setIngredientId(ingredientId);
        w.setQuantity(new BigDecimal(qty));
        return w;
    }
}
