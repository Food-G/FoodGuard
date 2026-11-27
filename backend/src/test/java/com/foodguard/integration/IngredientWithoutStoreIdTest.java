package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 메뉴 관리·식자재 목록 화면은 storeId 없이 /api/ingredients 를 부른다. */
class IngredientWithoutStoreIdTest extends IntegrationTest {

    @Test
    void ownerSeesOnlyIngredientsTheirStoreOwnsOrUses() throws Exception {
        User owner = user("OWNER");
        Store mine = store(owner);
        Store other = store(user("OWNER"));
        Ingredient own = ingredient("kg", null);
        own.setStore(mine);
        ingredients.save(own);
        Ingredient foreign = ingredient("kg", null);
        foreign.setStore(other);
        ingredients.save(foreign);
        // 매장이 빈 기존 식자재: 내 레시피에 쓰인 것 / 다른 매장 재고에만 있는 것
        Ingredient sharedUsed = ingredient("kg", null);
        recipe(menu(mine), sharedUsed, 100, "g");
        Ingredient sharedOthers = ingredient("kg", null);
        stock(other, sharedOthers, 5);

        getAs(owner, "/api/ingredients").andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", containsInAnyOrder(own.getId().intValue(), sharedUsed.getId().intValue())));
    }

    @Test
    void ownerCreatesIngredientInOwnStore() throws Exception {
        User owner = user("OWNER");
        Store mine = store(owner);

        postAs(owner, "/api/ingredients", Map.of("name", "양상추", "unit", "kg")).andExpect(status().isOk());

        Ingredient created = ingredients.findAll().stream().filter(i -> "양상추".equals(i.getName())).findFirst().orElseThrow();
        assertEquals(mine.getId(), created.getStore().getId());
    }

    @Test
    void imageCanBeChosenResetAndIsValidated() throws Exception {
        User owner = user("OWNER");
        store(owner);
        postAs(owner, "/api/ingredients", Map.of("name", "토마토", "unit", "kg", "imageUrl", "icon:tomato")).andExpect(status().isOk());
        Ingredient created = ingredients.findAll().stream().filter(i -> "토마토".equals(i.getName())).findFirst().orElseThrow();
        assertEquals("icon:tomato", created.getImageUrl());

        // 이름·단위만 고치면 사진은 그대로
        putAs(owner, "/api/ingredients/" + created.getId(), Map.of("name", "방울토마토", "unit", "kg")).andExpect(status().isOk());
        assertEquals("icon:tomato", ingredients.findById(created.getId()).orElseThrow().getImageUrl());

        // 형식이 다르면 거부, 빈 값이면 자동으로 되돌림
        putAs(owner, "/api/ingredients/" + created.getId(), Map.of("name", "방울토마토", "unit", "kg", "imageUrl", "javascript:alert(1)"))
                .andExpect(status().isBadRequest());
        putAs(owner, "/api/ingredients/" + created.getId(), Map.of("name", "방울토마토", "unit", "kg", "imageUrl", ""))
                .andExpect(status().isOk());
        assertEquals(null, ingredients.findById(created.getId()).orElseThrow().getImageUrl());
    }

    @Test
    void updateWithNameAndUnitOnlyKeepsOrderSettings() throws Exception {
        User owner = user("OWNER");
        Store mine = store(owner);
        Ingredient i = ingredient("kg", 3);
        i.setStore(mine);
        i.setLeadTimeDays(2);
        ingredients.save(i);

        putAs(owner, "/api/ingredients/" + i.getId(), Map.of("name", "새이름", "unit", "kg")).andExpect(status().isOk());

        Ingredient after = ingredients.findById(i.getId()).orElseThrow();
        assertEquals("새이름", after.getName());
        assertEquals(3, after.getShelfLifeDays());
        assertEquals(2, after.getLeadTimeDays());
    }
}
