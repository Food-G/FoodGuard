package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.WasteRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// DB 없이 본사 통계의 폐기율·추천 적용률 계산만 검증
class StatsServiceTest {

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
