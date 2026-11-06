package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// DB·AI 없이 에이전트 기능의 코드 쪽 규칙 검증 (입력 저장 경계, 감시 규칙, 이력 계산, 주간 지표)
class AgentFeaturesTest {

    private static final long STORE = 1L;
    private final LocalDate today = LocalDate.now();

    private final MenuRepository menuRepository = mock(MenuRepository.class);
    private final MenuIngredientRepository menuIngredientRepository = mock(MenuIngredientRepository.class);
    private final IngredientRepository ingredientRepository = mock(IngredientRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);
    private final SalesDataRepository salesDataRepository = mock(SalesDataRepository.class);
    private final StoreRepository storeRepository = mock(StoreRepository.class);
    private final PredictionResultRepository predictionResultRepository = mock(PredictionResultRepository.class);
    private final OrderRequestRepository orderRequestRepository = mock(OrderRequestRepository.class);
    private final NotificationRepository notificationRepository = mock(NotificationRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);

    private final IngestService ingest = new IngestService(mock(AiClient.class), menuRepository, ingredientRepository,
            inventoryRepository, salesDataRepository, storeRepository);
    private final WatchdogService watchdog = new WatchdogService(inventoryRepository, menuRepository, menuIngredientRepository,
            predictionResultRepository, orderRequestRepository, salesDataRepository, notificationRepository, notificationService, storeRepository);

    private static Store store() {
        Store s = new Store();
        s.setId(STORE);
        return s;
    }

    private static Menu menu(long id, String name) {
        Menu m = new Menu();
        m.setId(id);
        m.setMenuName(name);
        m.setStore(store());
        return m;
    }

    private static Ingredient ingredient(long id, String name) {
        Ingredient i = new Ingredient();
        i.setId(id);
        i.setName(name);
        i.setUnit("kg");
        return i;
    }

    private static Inventory inventory(Ingredient ing, String qty, LocalDate expiry) {
        Inventory inv = new Inventory();
        inv.setIngredient(ing);
        inv.setCurrentQty(new BigDecimal(qty));
        inv.setUnit(ing.getUnit());
        inv.setExpiryDate(expiry);
        return inv;
    }

    private static Map<String, Object> saleRow(long menuId, LocalDate date, int qty) {
        return Map.of("menuId", menuId, "saleDate", date.toString(), "quantity", qty);
    }

    @Test
    void 판매_파일_저장은_이미_입력된_날짜_메뉴를_건너뛴다() {
        LocalDate day = today.minusDays(1);
        SalesData existing = new SalesData();
        existing.setSaleDate(day);
        existing.setMenu(menu(10L, "김밥"));
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(menu(10L, "김밥"), menu(11L, "라면")));
        when(salesDataRepository.findByStoreIdAndIsDeletedFalse(STORE)).thenReturn(List.of(existing));

        Map<String, Object> r = ingest.commitSales(STORE, List.of(saleRow(10L, day, 5), saleRow(11L, day, 3), saleRow(11L, day, 3)));

        assertThat(r).containsEntry("created", 1).containsEntry("skippedExisting", 2);
        verify(salesDataRepository, times(1)).save(any());
    }

    @Test
    void 판매_파일_저장은_다른_매장_메뉴와_미래_날짜를_거부한다() {
        when(menuRepository.findByStoreId(STORE)).thenReturn(List.of(menu(10L, "김밥")));
        when(salesDataRepository.findByStoreIdAndIsDeletedFalse(STORE)).thenReturn(List.of());

        assertThatThrownBy(() -> ingest.commitSales(STORE, List.of(saleRow(99L, today, 1))))
                .hasMessageContaining("이 가맹점의 메뉴가 아닙니다");
        assertThatThrownBy(() -> ingest.commitSales(STORE, List.of(saleRow(10L, today.plusDays(1), 1))))
                .hasMessageContaining("미래 날짜");
        verify(salesDataRepository, never()).save(any());
    }

    @Test
    void 명세서_입고는_재고에_더하고_더_이른_유통기한을_남긴다() {
        Ingredient lettuce = ingredient(5L, "양상추");
        Inventory inv = inventory(lettuce, "2", today.plusDays(10));
        when(ingredientRepository.findByStoreIdIncludingLegacy(STORE)).thenReturn(List.of(lettuce));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE, 5L)).thenReturn(Optional.of(inv));

        ingest.commitInvoice(STORE, List.of(Map.of("ingredientId", 5L, "quantity", 8, "expiryDate", today.plusDays(3).toString())));

        assertThat(inv.getCurrentQty().doubleValue()).isEqualTo(10.0);
        assertThat(inv.getExpiryDate()).isEqualTo(today.plusDays(3));

        assertThatThrownBy(() -> ingest.commitInvoice(STORE, List.of(Map.of("ingredientId", 77L, "quantity", 1))))
                .hasMessageContaining("이 가맹점의 식자재가 아닙니다");
    }

    @Test
    void 감시는_음수_기한초과_폐기위험_레시피누락을_찾는다() {
        Ingredient negative = ingredient(1L, "치즈");
        Ingredient expired = ingredient(2L, "두부");
        Ingredient risky = ingredient(3L, "양상추");
        Ingredient safe = ingredient(4L, "쌀");
        Menu noRecipe = menu(20L, "신메뉴");
        Menu burger = menu(21L, "버거");
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(burger);
        mi.setIngredient(risky);
        mi.setQtyPerUnit(new BigDecimal("1"));
        mi.setUnit("kg");
        PredictionResult p = new PredictionResult();
        p.setMenu(burger);
        p.setPredictionDate(today.plusDays(1));
        p.setPredictedQty(3);

        when(menuRepository.findByStoreIdAndIsActiveTrue(STORE)).thenReturn(List.of(noRecipe, burger));
        when(menuIngredientRepository.findByMenuId(20L)).thenReturn(List.of());
        when(menuIngredientRepository.findByMenuId(21L)).thenReturn(List.of(mi));
        when(predictionResultRepository.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(eq(STORE), any())).thenReturn(List.of(p));
        when(inventoryRepository.findByStoreId(STORE)).thenReturn(List.of(
                inventory(negative, "-1", null),
                inventory(expired, "4", today.minusDays(1)),
                inventory(risky, "10", today.plusDays(2)),   // 기한까지 사용 3 → 7 위험
                inventory(safe, "10", today.plusDays(60))));
        when(salesDataRepository.findLastSaleDate(STORE)).thenReturn(today.minusDays(1));
        when(orderRequestRepository.findByStoreIdAndStatus(STORE, "REQUESTED")).thenReturn(List.of());

        List<Map<String, Object>> findings = watchdog.findings(STORE);

        assertThat(findings).extracting(f -> f.get("type")).containsExactlyInAnyOrder(
                "MISSING_RECIPE", "NEGATIVE_STOCK", "EXPIRED_STOCK", "WASTE_RISK", "MISSING_SETTINGS");
        assertThat(findings).filteredOn(f -> "WASTE_RISK".equals(f.get("type"))).first()
                .satisfies(f -> assertThat((String) f.get("message")).contains("7.0kg"));
    }

    @Test
    void 감시_알림은_안_읽은_같은_내용을_다시_만들지_않고_LOW_는_알리지_않는다() {
        Menu noRecipe = menu(20L, "신메뉴");
        when(menuRepository.findByStoreIdAndIsActiveTrue(STORE)).thenReturn(List.of(noRecipe));
        when(menuIngredientRepository.findByMenuId(20L)).thenReturn(List.of());
        when(inventoryRepository.findByStoreId(STORE)).thenReturn(List.of());
        when(predictionResultRepository.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(eq(STORE), any())).thenReturn(List.of());
        when(orderRequestRepository.findByStoreIdAndStatus(STORE, "REQUESTED")).thenReturn(List.of());
        Notification old = new Notification();
        old.setMessage("메뉴 '신메뉴'에 레시피가 없어 발주 계산에서 빠집니다.");
        when(notificationRepository.findByStoreIdAndIsReadFalse(STORE)).thenReturn(List.of(old));

        int created = watchdog.notifyStore(STORE);

        assertThat(created).isEqualTo(1); // 예측 없음만 새로
        verify(notificationService).create(eq(STORE), contains("수요 예측이 없습니다"), eq("ACCURACY"));
    }

    private static OrderRequest order(LocalDate orderedOn, LocalDate receivedOn) {
        OrderRequest o = new OrderRequest();
        o.setOrderedAt(orderedOn.atTime(9, 0));
        if (receivedOn != null) o.setOwnerReceivedAt(LocalDateTime.of(receivedOn, java.time.LocalTime.NOON));
        return o;
    }

    @Test
    void 발주_이력이_충분할_때만_주기와_입고기간을_계산한다() {
        LocalDate d = LocalDate.of(2026, 10, 1);
        List<OrderRequest> few = List.of(order(d, null), order(d.plusDays(3), null));
        assertThat(AgentService.observedCycleDays(few)).isNull();
        assertThat(AgentService.observedLeadDays(few)).isNull();

        List<OrderRequest> many = List.of(order(d, d.plusDays(2)), order(d.plusDays(3), d.plusDays(5)),
                order(d.plusDays(6), d.plusDays(7)), order(d.plusDays(10), d.plusDays(12)));
        assertThat(AgentService.observedCycleDays(many)).isEqualTo(3);
        assertThat(AgentService.observedLeadDays(many)).isEqualTo(2);
    }

    @Test
    void 주간_지표는_급락_입력없음을_표시하고_판매_없는_매장을_뺀다() {
        Store drop = new Store(), noInput = new Store(), steady = new Store(), none = new Store();
        drop.setId(1L);
        noInput.setId(2L);
        steady.setId(3L);
        none.setId(4L);
        LocalDate end = LocalDate.of(2026, 10, 16);

        Map<String, Object> facts = AgentService.weeklyFacts(end,
                Map.of(1L, 60L, 3L, 100L), Map.of(1L, 100L, 2L, 50L, 3L, 90L),
                List.of(drop, noInput, steady, none), List.of(), List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stores = (List<Map<String, Object>>) facts.get("stores");
        assertThat(stores).extracting(s -> s.get("storeId")).containsExactly(1L, 2L, 3L);
        assertThat(stores.get(0).get("changePct")).isEqualTo(-40.0);
        assertThat(stores.get(0).get("flags")).isEqualTo(List.of("SALES_DROP"));
        assertThat(stores.get(1).get("flags")).isEqualTo(List.of("NO_SALES_INPUT"));
        assertThat(stores.get(2).get("flags")).isEqualTo(List.of());
    }
}
