package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 식자재 목록 + 발주 통합: 이름으로 발주하면 식자재가 없을 때만 자동 등록되고, 공용 목록 수정·삭제는 본사만. */
class OrderByNameTest extends IntegrationTest {

    private User owner, hq;
    private Store store;

    @BeforeEach
    void setUp() {
        owner = user("OWNER");
        hq = user("HQ_ADMIN");
        store = store(owner);
    }

    private long countNamed(String name, String unit) {
        return ingredients.findAll().stream().filter(i -> i.getName().equals(name) && i.getUnit().equals(unit)).count();
    }

    @Test
    void orderingByNewNameRegistersIngredientOnceAndReusesIt() throws Exception {
        String name = "테스트대파" + System.nanoTime();
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", "  " + name + " ", "unit", "kg", "quantity", 3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredient.name").value(name))
                .andExpect(jsonPath("$.status").value("REQUESTED"));
        assertThat(countNamed(name, "kg")).isEqualTo(1);

        // 같은 이름·단위로 다시 발주하면 새로 만들지 않는다
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", name, "unit", "kg", "quantity", 1))
                .andExpect(status().isOk());
        assertThat(countNamed(name, "kg")).isEqualTo(1);
        assertThat(orders.findByStoreId(store.getId())).hasSize(2);

        // 단위가 다르면 다른 식자재
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", name, "unit", "개", "quantity", 10))
                .andExpect(status().isOk());
        assertThat(countNamed(name, "개")).isEqualTo(1);
    }

    @Test
    void existingIngredientIsReusedByName() throws Exception {
        Ingredient onion = ingredient("kg", null);
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", onion.getName(), "unit", "kg", "quantity", 2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredient.id").value(onion.getId()));
    }

    @Test
    void invalidOrderIsRejected() throws Exception {
        long before = ingredients.count();
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", "양파", "unit", "kg", "quantity", 0))
                .andExpect(status().isBadRequest());
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", "양파", "unit", "상자", "quantity", 1))
                .andExpect(status().isBadRequest());
        postAs(owner, "/api/orders", Map.of("storeId", store.getId(), "ingredientName", " ", "unit", "kg", "quantity", 1))
                .andExpect(status().isBadRequest());
        assertThat(ingredients.count()).isEqualTo(before);
        assertThat(orders.findByStoreId(store.getId())).isEmpty();
    }

    @Test
    void onlyHqEditsOrDeletesSharedIngredients() throws Exception {
        Ingredient onion = ingredient("kg", null);
        Map<String, Object> body = Map.of("name", onion.getName() + "수정", "unit", "kg");
        putAs(owner, "/api/ingredients/" + onion.getId(), body).andExpect(status().isForbidden());
        deleteAs(owner, "/api/ingredients/" + onion.getId()).andExpect(status().isForbidden());
        assertThat(ingredients.findById(onion.getId())).isPresent();

        putAs(hq, "/api/ingredients/" + onion.getId(), body).andExpect(status().isOk());
    }
}
