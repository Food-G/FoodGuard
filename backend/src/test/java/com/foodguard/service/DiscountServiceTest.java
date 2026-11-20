package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// DB 없이 할인 소진 규칙 검증: 후보 계산, 입력 경계, POS 결제의 가격·재고 처리
class DiscountServiceTest {

    private static final long STORE = 1L;
    private final LocalDate today = LocalDate.now();

    private final MenuDiscountRepository discountRepository = mock(MenuDiscountRepository.class);
    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final MenuIngredientRepository menuIngredientRepository = mock(MenuIngredientRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);
    private final PredictionResultRepository predictionRepository = mock(PredictionResultRepository.class);
    private final DonationRecordRepository donationRepository = mock(DonationRecordRepository.class);
    private final SalesDataRepository salesRepository = mock(SalesDataRepository.class);

    private final DiscountService service = new DiscountService(discountRepository, menuRepository, menuIngredientRepository,
            inventoryRepository, predictionRepository, donationRepository, salesRepository, mock(AiClient.class));

    private final Ingredient lettuce = ingredient(5L, "양상추");
    private final Menu burger = menu(10L, "버거", 5000);

    private static Ingredient ingredient(long id, String name) {
        Ingredient i = new Ingredient();
        i.setId(id);
        i.setName(name);
        i.setUnit("kg");
        return i;
    }

    private static Menu menu(long id, String name, int price) {
        Menu m = new Menu();
        m.setId(id);
        m.setMenuName(name);
        m.setPrice(price);
        Store s = new Store();
        s.setId(STORE);
        m.setStore(s);
        return m;
    }

    private MenuIngredient recipe(Menu m, Ingredient i, String grams) {
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(m);
        mi.setIngredient(i);
        mi.setQtyPerUnit(new BigDecimal(grams));
        mi.setUnit("g");
        return mi;
    }

    private Inventory inventory(Ingredient i, String qty, LocalDate expiry) {
        Inventory inv = new Inventory();
        inv.setIngredient(i);
        inv.setCurrentQty(new BigDecimal(qty));
        inv.setUnit("kg");
        inv.setExpiryDate(expiry);
        return inv;
    }

    private MenuDiscount discount(long menuId, int pct) {
        MenuDiscount d = new MenuDiscount();
        d.setId(100L);
        d.setMenuId(menuId);
        d.setDiscountPct(pct);
        d.setEndDate(today.plusDays(2));
        return d;
    }

    @Test
    void 후보는_임박하고_예측_사용량을_빼도_남는_재고이고_더_팔아야_할_개수를_계산한다() {
        Ingredient safe = ingredient(6L, "쌀");
        Ingredient late = ingredient(7L, "치즈");
        PredictionResult p = new PredictionResult();
        p.setMenu(burger);
        p.setPredictionDate(today.plusDays(1));
        p.setPredictedQty(20); // 양상추 2kg 사용

        when(menuRepository.findByStoreIdAndIsActiveTrue(STORE)).thenReturn(List.of(burger));
        when(menuIngredientRepository.findByMenuId(10L)).thenReturn(List.of(recipe(burger, lettuce, "100"), recipe(burger, safe, "100")));
        when(predictionRepository.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(eq(STORE), any())).thenReturn(List.of(p));
        when(donationRepository.findByStoreIdAndStatus(STORE, "PLANNED")).thenReturn(List.of());
        when(discountRepository.findActiveOn(eq(STORE), any())).thenReturn(List.of(discount(10L, 20)));
        when(inventoryRepository.findByStoreId(STORE)).thenReturn(List.of(
                inventory(lettuce, "5", today.plusDays(2)),  // 사용 2 → 3 남음
                inventory(safe, "1", today.plusDays(2)),     // 다 쓴다
                inventory(late, "9", today.plusDays(30))));  // 아직 멀다

        List<Map<String, Object>> c = service.candidates(STORE);

        assertThat(c).hasSize(1);
        assertThat(c.get(0)).containsEntry("ingredientName", "양상추").containsEntry("surplus", 3.0).containsEntry("daysLeft", 2L);
        @SuppressWarnings("unchecked")
        Map<String, Object> m = ((List<Map<String, Object>>) c.get(0).get("menus")).get(0);
        assertThat(m).containsEntry("extraUnitsToClear", 30L).containsEntry("activeDiscountPct", 20);
    }

    @Test
    void 할인_입력은_범위와_매장을_검사하고_이전_할인을_끝낸다() {
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(burger));
        MenuDiscount old = discount(10L, 10);
        old.setActive(true);
        when(discountRepository.findByStoreIdAndMenuIdAndActiveTrue(STORE, 10L)).thenReturn(List.of(old));

        Map<String, Object> r = service.apply(STORE, 10L, 5L, 70, today.plusDays(2));

        assertThat(old.isActive()).isFalse();
        assertThat(r).containsEntry("discountedPrice", 1500).containsEntry("belowCost", true);
        assertThatThrownBy(() -> service.apply(STORE, 10L, null, 0, today)).hasMessageContaining("할인율");
        assertThatThrownBy(() -> service.apply(STORE, 10L, null, 91, today)).hasMessageContaining("할인율");
        assertThatThrownBy(() -> service.apply(STORE, 10L, null, 10, today.minusDays(1))).hasMessageContaining("종료일");
        assertThatThrownBy(() -> service.apply(STORE, 10L, null, 10, today.plusDays(31))).hasMessageContaining("기간");
        assertThatThrownBy(() -> service.apply(STORE, 99L, null, 10, today)).hasMessageContaining("메뉴가 아닙니다");
    }

    @Test
    void 결제는_서버_할인가로_판매를_기록하고_재고를_차감한다() {
        Menu plain = menu(11L, "콜라", 2000);
        Inventory inv = inventory(lettuce, "1", today.plusDays(2));
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(burger, plain));
        when(discountRepository.findActiveOn(eq(STORE), any())).thenReturn(List.of(discount(10L, 30)));
        when(menuIngredientRepository.findByMenuId(10L)).thenReturn(List.of(recipe(burger, lettuce, "100")));
        when(menuIngredientRepository.findByMenuId(11L)).thenReturn(List.of(recipe(plain, ingredient(9L, "시럽"), "10")));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 5L)).thenReturn(Optional.of(inv));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 9L)).thenReturn(Optional.empty());

        Map<String, Object> r = service.checkout(STORE, List.of(
                Map.of("menuId", 10L, "quantity", 15, "price", 1), // 화면이 보낸 가격은 무시
                Map.of("menuId", 11L, "quantity", 1)));

        assertThat(r).containsEntry("total", 3500L * 15 + 2000);
        ArgumentCaptor<SalesData> sale = ArgumentCaptor.forClass(SalesData.class);
        verify(salesRepository, times(2)).save(sale.capture());
        assertThat(sale.getAllValues().get(0).getUnitPrice()).isEqualTo(3500);
        assertThat(sale.getAllValues().get(0).getDiscountPct()).isEqualTo(30);
        assertThat(sale.getAllValues().get(1).getUnitPrice()).isEqualTo(2000);
        assertThat(sale.getAllValues().get(1).getDiscountPct()).isNull();
        assertThat(inv.getCurrentQty().doubleValue()).isEqualTo(-0.5); // 음수는 점검이 알린다
    }

    @Test
    void 결제는_다른_매장_메뉴와_빈_주문을_거부한다() {
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(burger));
        when(discountRepository.findActiveOn(eq(STORE), any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.checkout(STORE, List.of(Map.of("menuId", 99L, "quantity", 1)))).hasMessageContaining("메뉴가 아닙니다");
        assertThatThrownBy(() -> service.checkout(STORE, List.of(Map.of("menuId", 10L, "quantity", 0)))).hasMessageContaining("수량");
        assertThatThrownBy(() -> service.checkout(STORE, List.of())).hasMessageContaining("결제할 메뉴");
        verify(salesRepository, never()).save(any());
    }
}
