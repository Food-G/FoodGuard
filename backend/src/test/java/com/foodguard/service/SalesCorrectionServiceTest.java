package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// DB·AI 없이 판매 수정의 경계 검증: 줄이는 순서, 재고 되돌리기, 확인 뒤 변경 감지, 저장 없는 미리보기
class SalesCorrectionServiceTest {

    private static final long STORE = 1L;
    private final LocalDate today = LocalDate.now();

    private final AiClient aiClient = mock(AiClient.class);
    private final SalesDataRepository salesRepository = mock(SalesDataRepository.class);
    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final MenuIngredientRepository recipeRepository = mock(MenuIngredientRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final SalesCorrectionService service = new SalesCorrectionService(aiClient, salesRepository, menuRepository, recipeRepository, inventoryRepository, notificationService);

    private final Menu burger = menu();
    private final Ingredient lettuce = ingredient();
    private final Inventory stock = inventory();

    private static Menu menu() {
        Menu m = new Menu();
        m.setId(10L);
        m.setMenuName("버거");
        m.setPrice(5000);
        return m;
    }

    private static Ingredient ingredient() {
        Ingredient i = new Ingredient();
        i.setId(5L);
        i.setName("양상추");
        i.setUnit("kg");
        return i;
    }

    private Inventory inventory() {
        Inventory inv = new Inventory();
        inv.setIngredient(lettuce);
        inv.setCurrentQty(new BigDecimal("1.0"));
        inv.setUnit("kg");
        return inv;
    }

    private SalesData sale(long id, int qty, Integer unitPrice) {
        SalesData s = new SalesData();
        s.setId(id);
        s.setMenu(burger);
        s.setSaleDate(today);
        s.setQuantity(qty);
        s.setUnitPrice(unitPrice);
        return s;
    }

    private void given(SalesData... rows) {
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(burger));
        when(salesRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(eq(STORE), any(), any())).thenReturn(List.of(rows));
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(burger);
        mi.setIngredient(lettuce);
        mi.setQtyPerUnit(new BigDecimal("100"));
        mi.setUnit("g");
        when(recipeRepository.findByMenuId(10L)).thenReturn(List.of(mi));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 5L)).thenReturn(Optional.of(stock));
    }

    private static Map<String, Object> change(LocalDate day, int current, int newTotal) {
        return Map.of("menuId", 10L, "saleDate", day.toString(), "currentTotal", current, "newTotal", newTotal);
    }

    @Test
    void 줄일_때는_최근_행부터_줄이고_POS_판매만_재고를_되돌린다() {
        SalesData old = sale(1, 2, null);   // 파일 등록: 재고 안 줄였음
        SalesData recent = sale(2, 3, 5000); // POS
        given(old, recent);

        service.apply(STORE, List.of(change(today, 5, 1)), "잘못 결제");

        assertThat(recent.isDeleted()).isTrue();
        assertThat(recent.getQuantity()).isEqualTo(3);      // 삭제 표시만, 수량은 기록으로 남는다
        assertThat(old.getQuantity()).isEqualTo(1);
        assertThat(old.isDeleted()).isFalse();
        assertThat(stock.getCurrentQty().doubleValue()).isEqualTo(1.3);  // POS 3개분만 복원
        verify(notificationService).create(eq(STORE), contains("5개 → 1개"), eq("SALES"));
    }

    @Test
    void 늘리면_POS_판매는_재고를_더_줄인다() {
        SalesData row = sale(1, 2, 5000);
        given(row);
        service.apply(STORE, List.of(change(today, 2, 4)), "더 팔림");
        assertThat(row.getQuantity()).isEqualTo(4);
        assertThat(stock.getCurrentQty().doubleValue()).isEqualTo(0.8);
    }

    @Test
    void 확인하는_사이_판매가_바뀌면_반영하지_않는다() {
        SalesData row = sale(1, 3, 5000);
        given(row);
        assertThatThrownBy(() -> service.apply(STORE, List.of(change(today, 2, 0)), "x")).hasMessageContaining("바뀌었습니다");
        assertThat(row.isDeleted()).isFalse();
        assertThat(stock.getCurrentQty().doubleValue()).isEqualTo(1.0);
    }

    @Test
    void 다른_매장_메뉴_오래된_날짜_미래_날짜_음수를_거부한다() {
        SalesData row = sale(1, 3, 5000);
        given(row);
        assertThatThrownBy(() -> service.apply(STORE, List.of(Map.of("menuId", 99L, "saleDate", today.toString(), "currentTotal", 3, "newTotal", 0)), "x")).hasMessageContaining("메뉴가 아닙니다");
        assertThatThrownBy(() -> service.apply(STORE, List.of(change(today.minusDays(14), 3, 0)), "x")).hasMessageContaining("14일");
        assertThatThrownBy(() -> service.apply(STORE, List.of(change(today.plusDays(1), 3, 0)), "x")).hasMessageContaining("미래");
        assertThatThrownBy(() -> service.apply(STORE, List.of(change(today, 3, -1)), "x")).hasMessageContaining("수량");
        assertThatThrownBy(() -> service.apply(STORE, List.of(), "x")).hasMessageContaining("수정 내용");
    }

    @Test
    void 미리보기는_금액과_재고_변화를_계산하고_아무것도_저장하지_않는다() {
        SalesData row = sale(1, 3, 3500);  // 할인 단가
        given(row);
        when(aiClient.post(anyString(), any())).thenReturn(Map.of("understood", "u",
                "actions", List.of(Map.of("saleDate", today.toString(), "menuId", 10, "newTotal", 1))));

        Map<String, Object> r = service.propose(STORE, "2개 취소");

        @SuppressWarnings("unchecked")
        Map<String, Object> c = ((List<Map<String, Object>>) r.get("changes")).get(0);
        assertThat(c).containsEntry("currentTotal", 3).containsEntry("newTotal", 1).containsEntry("amountChange", -7000L);
        assertThat(c.get("stockChanges").toString()).contains("0.2");
        assertThat(row.getQuantity()).isEqualTo(3);
        assertThat(row.isDeleted()).isFalse();
        assertThat(stock.getCurrentQty().doubleValue()).isEqualTo(1.0);
        verify(salesRepository, never()).save(any());
        verify(notificationService, never()).create(any(), any(), any());
    }
}
