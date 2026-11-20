package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB·AI 서비스 없이 레시피 초안 요청에 담기는 식자재 후보만 검증
class RecipeDraftServiceTest {

    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final IngredientRepository ingredientRepository = mock(IngredientRepository.class);
    private final MenuIngredientRepository menuIngredientRepository = mock(MenuIngredientRepository.class);
    private final RestTemplate restTemplate = mock(RestTemplate.class);

    private final RecipeDraftService service = new RecipeDraftService(
            menuRepository, ingredientRepository, menuIngredientRepository, restTemplate);

    @Test
    @SuppressWarnings("unchecked")
    void 이미_연결된_식자재는_빼고_레시피_단위로_후보를_보낸다() {
        Store store = new Store();
        store.setId(3L);
        Menu menu = new Menu();
        menu.setId(10L);
        menu.setMenuName("불고기 덮밥");
        menu.setStore(store);
        when(menuRepository.findById(10L)).thenReturn(Optional.of(menu));

        Ingredient rice = ingredient(1L, "쌀", "kg");
        Ingredient sauce = ingredient(2L, "소스", "L");
        Ingredient egg = ingredient(3L, "계란", "개");
        when(ingredientRepository.findByStoreIdIncludingLegacy(3L)).thenReturn(List.of(rice, sauce, egg));
        MenuIngredient linked = new MenuIngredient();
        linked.setIngredient(egg);
        when(menuIngredientRepository.findByMenuId(10L)).thenReturn(List.of(linked));
        when(restTemplate.postForObject(anyString(), org.mockito.ArgumentMatchers.any(), eq(Map.class)))
                .thenReturn(Map.of("items", List.of(), "missing", List.of()));

        service.draft(10L);

        ArgumentCaptor<Object> body = ArgumentCaptor.forClass(Object.class);
        verify(restTemplate).postForObject(anyString(), body.capture(), eq(Map.class));
        Map<String, Object> sent = (Map<String, Object>) body.getValue();
        assertThat(sent.get("menuName")).isEqualTo("불고기 덮밥");
        assertThat(sent.get("linked")).isEqualTo(List.of("계란"));
        assertThat((List<Map<String, Object>>) sent.get("ingredients")).containsExactly(
                Map.of("ingredientId", 1L, "name", "쌀", "unit", "g"),
                Map.of("ingredientId", 2L, "name", "소스", "unit", "ml"));
    }

    private Ingredient ingredient(Long id, String name, String unit) {
        Ingredient i = new Ingredient();
        i.setId(id);
        i.setName(name);
        i.setUnit(unit);
        return i;
    }
}
