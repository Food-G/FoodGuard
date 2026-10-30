package com.foodguard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.PredictionResult;
import com.foodguard.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// DB 없이 recommend()의 식자재별 발주 기간(보관기한·리드타임·발주 주기) 계산만 검증
class OrderRequestServiceRecommendTest {

    private static final long STORE_ID = 1L;

    private final OrderRequestRepository orderRequestRepository = mock(OrderRequestRepository.class);
    private final PredictionResultRepository predictionResultRepository = mock(PredictionResultRepository.class);
    private final MenuIngredientRepository menuIngredientRepository = mock(MenuIngredientRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);

    private final OrderRequestService service = new OrderRequestService(
            orderRequestRepository, mock(StoreRepository.class), mock(IngredientRepository.class),
            predictionResultRepository, menuIngredientRepository, inventoryRepository,
            new ObjectMapper(), mock(NotificationService.class));

    @Test
    void 식자재마다_보관기한과_발주주기_안의_수요만_발주한다() {
        Menu menu = new Menu();
        menu.setId(10L);
        menu.setMenuName("비빔밥");

        // 메뉴 1개가 내일부터 7일간 하루 10개 팔린다고 추천
        LocalDate today = LocalDate.now();
        List<PredictionResult> predictions = new ArrayList<>();
        for (int d = 1; d <= 7; d++) {
            PredictionResult p = new PredictionResult();
            p.setMenu(menu);
            p.setPredictionDate(today.plusDays(d));
            p.setPredictedQty(10);
            p.setRecommendedOrderQty(10);
            predictions.add(p);
        }
        when(predictionResultRepository.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(eq(STORE_ID), any()))
                .thenReturn(predictions);

        Ingredient rice = ingredient(100L, "쌀", null, null, null);   // 설정 없음 → 기존처럼 7일치
        Ingredient lettuce = ingredient(200L, "상추", 2, 1, null);    // 다음날 입고, 보관 2일 → 2일치
        Ingredient onion = ingredient(300L, "양파", null, 2, 3);      // 2일 뒤 입고, 3일마다 입고 → 입고 전 1일 + 3일 = 4일치
        when(menuIngredientRepository.findByMenuId(10L)).thenReturn(List.of(
                recipe(menu, rice, "200"), recipe(menu, lettuce, "100"), recipe(menu, onion, "50")));
        when(inventoryRepository.findByStoreId(STORE_ID)).thenReturn(List.of());
        when(orderRequestRepository.findByStoreIdAndStatusIn(eq(STORE_ID), anyList())).thenReturn(List.of());

        List<Map<String, Object>> recs = service.recommend(STORE_ID);
        Map<String, Double> orderQty = recs.stream().collect(Collectors.toMap(
                r -> (String) r.get("ingredientName"), r -> ((Number) r.get("orderQty")).doubleValue()));

        assertThat(orderQty).containsEntry("쌀", 14.0);   // 7일 × 10개 × 0.2kg
        assertThat(orderQty).containsEntry("상추", 2.0);  // 2일 × 10개 × 0.1kg
        assertThat(orderQty).containsEntry("양파", 2.0);  // 4일 × 10개 × 0.05kg

        // 근거 설명용 필드: 책임 기간, 보관기한, 메뉴별 기여 (설명 문장의 재료)
        Map<String, Object> lettuceRec = recs.stream().filter(r -> "상추".equals(r.get("ingredientName"))).findFirst().orElseThrow();
        assertThat(lettuceRec.get("coverageDays")).isEqualTo(2);
        assertThat(lettuceRec.get("shelfLifeDays")).isEqualTo(2);
        assertThat(lettuceRec.get("pointQty")).isEqualTo(2.0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> contributions = (List<Map<String, Object>>) lettuceRec.get("contributions");
        assertThat(contributions).singleElement().satisfies(c -> {
            assertThat(c.get("menuName")).isEqualTo("비빔밥");
            assertThat(c.get("menuQty")).isEqualTo(20);
        });
    }

    private static Ingredient ingredient(Long id, String name, Integer shelfLife, Integer leadTime, Integer orderCycle) {
        Ingredient ing = new Ingredient();
        ing.setId(id);
        ing.setName(name);
        ing.setUnit("kg");
        ing.setShelfLifeDays(shelfLife);
        ing.setLeadTimeDays(leadTime);
        ing.setOrderCycleDays(orderCycle);
        return ing;
    }

    private static MenuIngredient recipe(Menu menu, Ingredient ing, String grams) {
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(menu);
        mi.setIngredient(ing);
        mi.setQtyPerUnit(new BigDecimal(grams));
        mi.setUnit("g");
        return mi;
    }
}
