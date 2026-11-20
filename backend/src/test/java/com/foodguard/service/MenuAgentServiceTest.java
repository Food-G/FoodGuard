package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

// DB·AI 없이 메뉴 관리 요청의 경계 검증: 식자재 이름 매칭, 단위, 삭제 제한, 저장 없는 미리보기
class MenuAgentServiceTest {

    private static final long STORE = 1L;

    private final AiClient aiClient = mock(AiClient.class);
    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final MenuIngredientRepository recipeRepository = mock(MenuIngredientRepository.class);
    private final IngredientRepository ingredientRepository = mock(IngredientRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);
    private final OrderRequestRepository orderRepository = mock(OrderRequestRepository.class);
    private final StoreRepository storeRepository = mock(StoreRepository.class);
    private final MenuAgentService service = new MenuAgentService(aiClient, menuRepository, recipeRepository, ingredientRepository, inventoryRepository, orderRepository, storeRepository);

    private final Store store = new Store();
    private final Menu burger = new Menu();
    private final Ingredient beef = ingredient(1L, "소고기", "kg", store);
    private final Ingredient sharedLettuce = ingredient(2L, "양상추", "kg", null);
    private final Ingredient bun = ingredient(3L, "버거빵", "개", store);

    private static Ingredient ingredient(long id, String name, String unit, Store owner) {
        Ingredient i = new Ingredient();
        i.setId(id);
        i.setName(name);
        i.setUnit(unit);
        i.setStore(owner);
        return i;
    }

    @BeforeEach
    void setUp() {
        store.setId(STORE);
        burger.setId(10L);
        burger.setMenuName("치즈버거");
        burger.setPrice(7000);
        burger.setStore(store);
        when(storeRepository.findById(STORE)).thenReturn(Optional.of(store));
        when(menuRepository.findByStoreIdAndIsActiveTrue(STORE)).thenReturn(List.of(burger));
        when(recipeRepository.findByMenuId(10L)).thenReturn(new ArrayList<>());
        when(ingredientRepository.findByStoreIdIncludingLegacy(STORE)).thenReturn(List.of(beef, sharedLettuce, bun));
        when(inventoryRepository.findByStoreId(STORE)).thenReturn(List.of());
        when(menuRepository.save(any())).thenAnswer(a -> {
            Menu m = a.getArgument(0);
            if (m.getId() == null) m.setId(99L);
            return m;
        });
        when(ingredientRepository.save(any())).thenAnswer(a -> {
            Ingredient i = a.getArgument(0);
            i.setId(50L);
            return i;
        });
    }

    private static Map<String, Object> item(String name, double qty, String unit) {
        return Map.of("name", name, "qtyPerUnit", qty, "unit", unit);
    }

    @Test
    void 메뉴를_레시피와_함께_추가하고_없는_식자재만_새로_만든다() {
        service.apply(STORE, List.of(Map.of("op", "ADD_MENU", "menuName", "불고기버거", "price", 4000,
                "ingredients", List.of(item("소 고기", 150, "g"), item("불고기 소스", 30, "ml"), item("버거빵", 1, "개")))));

        ArgumentCaptor<Ingredient> created = ArgumentCaptor.forClass(Ingredient.class);
        verify(ingredientRepository, times(1)).save(created.capture());  // 소고기·버거빵은 재사용 (띄어쓰기 달라도)
        assertThat(created.getValue().getName()).isEqualTo("불고기 소스");
        assertThat(created.getValue().getUnit()).isEqualTo("L");
        assertThat(created.getValue().getStore()).isSameAs(store);
        verify(recipeRepository, times(3)).save(any());
    }

    @Test
    void 같은_이름_메뉴_음수_가격_단위_불일치_사용량_0을_거부한다() {
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "ADD_MENU", "menuName", "치즈 버거", "price", 1000)))).hasMessageContaining("이미 있습니다");
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "ADD_MENU", "menuName", "새메뉴", "price", -1)))).hasMessageContaining("가격");
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "ADD_INGREDIENTS", "menuId", 10, "ingredients", List.of(item("버거빵", 100, "g")))))).hasMessageContaining("개 단위");
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "ADD_INGREDIENTS", "menuId", 10, "ingredients", List.of(item("소고기", 0, "g")))))).hasMessageContaining("0보다");
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "UPDATE_MENU", "menuId", 999, "price", 1)))).hasMessageContaining("메뉴가 아닙니다");
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "HACK")))).hasMessageContaining("지원하지 않는");
        verify(menuRepository, never()).save(any());
    }

    @Test
    void 공용_식자재와_발주_기록_재고_있는_식자재는_삭제하지_않는다() {
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "DELETE_INGREDIENT", "ingredientId", 2)))).hasMessageContaining("공용");

        when(orderRepository.existsByIngredientId(1L)).thenReturn(true);
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "DELETE_INGREDIENT", "ingredientId", 1)))).hasMessageContaining("발주 기록");

        Inventory stock = new Inventory();
        stock.setIngredient(bun);
        stock.setCurrentQty(new BigDecimal("3"));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 3L)).thenReturn(Optional.of(stock));
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("op", "DELETE_INGREDIENT", "ingredientId", 3)))).hasMessageContaining("재고");
        verify(ingredientRepository, never()).deleteById(any());
    }

    @Test
    void 쓰이지_않는_전용_식자재는_레시피와_함께_삭제한다() {
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(burger);
        mi.setIngredient(beef);
        when(recipeRepository.findByMenuId(10L)).thenReturn(new ArrayList<>(List.of(mi)));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 1L)).thenReturn(Optional.empty());

        service.apply(STORE, List.of(Map.of("op", "DELETE_INGREDIENT", "ingredientId", 1)));

        verify(recipeRepository).delete(mi);
        verify(ingredientRepository).deleteById(1L);
    }

    @Test
    void 메뉴_삭제는_비활성화만_하고_레시피에서_빼기는_그_식자재만_뺀다() {
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(burger);
        mi.setIngredient(sharedLettuce);
        when(recipeRepository.findByMenuId(10L)).thenReturn(new ArrayList<>(List.of(mi)));

        service.apply(STORE, List.of(Map.of("op", "REMOVE_INGREDIENTS", "menuId", 10, "removeIngredients", List.of(Map.of("ingredientId", 2)))));
        verify(recipeRepository).delete(mi);
        verify(ingredientRepository, never()).deleteById(any());  // 공용 식자재도 이 메뉴에서만 빠진다

        service.apply(STORE, List.of(Map.of("op", "DELETE_MENU", "menuId", 10)));
        assertThat(burger.isActive()).isFalse();
        verify(menuRepository, never()).delete(any());
    }

    @Test
    void 미리보기는_저장하지_않고_추정과_새_식자재를_표시한다() {
        when(aiClient.post(anyString(), any())).thenReturn(Map.of("understood", "u", "changes", List.of(Map.of(
                "op", "ADD_MENU", "menuName", "불고기버거", "price", 4000,
                "ingredients", List.of(Map.of("name", "상추", "qty", 20, "unit", "g", "estimated", true))))));

        Map<String, Object> r = service.propose(STORE, "불고기버거 4000원, 상추 들어가");

        assertThat(r.get("changes").toString()).contains("isNew=true", "estimated=true", "baseUnit=kg");
        verify(menuRepository, never()).save(any());
        verify(ingredientRepository, never()).save(any());
        verify(recipeRepository, never()).save(any());
    }
}
