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
    void ownerListsOwnAndSharedIngredientsButNotOtherStores() throws Exception {
        User owner = user("OWNER");
        Store mine = store(owner);
        Store other = store(user("OWNER"));
        Ingredient shared = ingredient("kg", null);
        Ingredient own = ingredient("kg", null);
        own.setStore(mine);
        ingredients.save(own);
        Ingredient foreign = ingredient("kg", null);
        foreign.setStore(other);
        ingredients.save(foreign);

        getAs(owner, "/api/ingredients").andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItems(shared.getId().intValue(), own.getId().intValue())))
                .andExpect(jsonPath("$[*].id", not(hasItem(foreign.getId().intValue()))));
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
