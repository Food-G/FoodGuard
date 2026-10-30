package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 재고 원장 (DB·Spring 컨텍스트 없음). */
class InventoryLedgerTest {

    private InventoryRepository invRepo;
    private InventoryTxnRepository txnRepo;
    private InventoryLotRepository lotRepo;
    private JdbcTemplate jdbc;
    private InventoryLedger ledger;
    private Store store;
    private Ingredient onion;

    @BeforeEach
    void setUp() {
        invRepo = mock(InventoryRepository.class);
        txnRepo = mock(InventoryTxnRepository.class);
        lotRepo = mock(InventoryLotRepository.class);
        jdbc = mock(JdbcTemplate.class);
        ledger = new InventoryLedger(invRepo, txnRepo, lotRepo, jdbc);
        ledger.detectTable();  // 기본 mock 은 예외 없음 → 테이블 있음
        store = new Store();
        store.setId(60006L);
        onion = new Ingredient();
        onion.setId(1L);
        onion.setUnit("kg");
        when(invRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private Inventory stock(double qty) {
        Inventory inv = new Inventory();
        inv.setStore(store);
        inv.setIngredient(onion);
        inv.setQuantity(qty);
        inv.setMinThreshold(BigDecimal.ZERO);
        inv.setUnit("kg");
        when(invRepo.findByStoreIdAndIngredientId(60006L, 1L)).thenReturn(Optional.of(inv));
        return inv;
    }

    private InventoryTxn onlyTxn() {
        ArgumentCaptor<InventoryTxn> c = ArgumentCaptor.forClass(InventoryTxn.class);
        verify(txnRepo).save(c.capture());
        return c.getValue();
    }

    @Test
    void applyAddsDeltaAndRecordsOneRow() {
        stock(2.5);
        Inventory r = ledger.apply(store, onion, 4.0, "ORDER_DONE", "ORDER_REQUEST", 9L);
        assertEquals(6.5, r.getCurrentQty().doubleValue());
        InventoryTxn t = onlyTxn();
        assertEquals(4.0, t.getDeltaQty().doubleValue());
        assertEquals(6.5, t.getQtyAfter().doubleValue());
        assertEquals("ORDER_DONE", t.getReason());
        assertEquals(9L, t.getRefId());
    }

    @Test
    void setRecordsDifference() {
        stock(10.0);
        ledger.set(store, onion, 7.25, "SALE", "SALES_DATA", 3L);
        assertEquals(-2.75, onlyTxn().getDeltaQty().doubleValue());
    }

    @Test
    void noRowWhenNothingChanges() {
        stock(5.0);
        ledger.set(store, onion, 5.0, "ADJUST", "INVENTORY", 1L);
        verify(txnRepo, never()).save(any());
    }

    @Test
    void missingInventoryRowStartsAtZero() {
        when(invRepo.findByStoreIdAndIngredientId(60006L, 1L)).thenReturn(Optional.empty());
        Inventory r = ledger.apply(store, onion, -1.5, "SALE", "SALES_DATA", 3L);
        assertEquals(-1.5, r.getCurrentQty().doubleValue());   // 부족분은 음수로 남긴다 (기존 동작)
        assertEquals("kg", r.getUnit());
        assertEquals(-1.5, onlyTxn().getQtyAfter().doubleValue());
    }

    @Test
    void removalRecordsDropToZero() {
        Inventory inv = stock(3.0);
        ledger.recordRemoval(List.of(inv), "INVENTORY", 5L);
        InventoryTxn t = onlyTxn();
        assertEquals(-3.0, t.getDeltaQty().doubleValue());
        assertEquals("ADJUST", t.getReason());
    }

    @Test
    void withoutTableInventoryStillUpdatesButNoLedger() {
        doThrow(new DataAccessResourceFailureException("no table")).when(jdbc).queryForList(anyString());
        ledger.detectTable();
        assertFalse(ledger.isEnabled());
        assertFalse(ledger.isLotsEnabled());
        stock(1.0);
        assertEquals(3.0, ledger.apply(store, onion, 2.0, "ORDER_DONE", null, null).getCurrentQty().doubleValue());
        verify(txnRepo, never()).save(any());
        verify(lotRepo, never()).saveAll(any());
    }

    // ── 입고 로트 (D-3) ─────────────────────────────────────────────

    private static InventoryLot lot(String qty, LocalDate expiry, int receivedDaysAgo) {
        InventoryLot l = new InventoryLot();
        l.setReceivedQty(new BigDecimal(qty));
        l.setRemainingQty(new BigDecimal(qty));
        l.setExpiryDate(expiry);
        l.setReceivedAt(LocalDateTime.now().minusDays(receivedDaysAgo));
        return l;
    }

    @SuppressWarnings("unchecked")
    private List<InventoryLot> savedLots() {
        ArgumentCaptor<List<InventoryLot>> c = ArgumentCaptor.forClass(List.class);
        verify(lotRepo).saveAll(c.capture());
        return c.getValue();
    }

    @Test
    void orderDoneCreatesLotWithShelfLifeExpiry() {
        onion.setShelfLifeDays(7);
        stock(0.0);
        ledger.apply(store, onion, 4.0, "ORDER_DONE", "ORDER_REQUEST", 9L);
        InventoryLot l = savedLots().get(0);
        assertEquals(new BigDecimal("4.000"), l.getRemainingQty());
        assertEquals(LocalDate.now().plusDays(7), l.getExpiryDate());
        assertEquals(9L, l.getOrderId());
    }

    @Test
    void noShelfLifeMeansNoExpiry() {
        stock(0.0);
        ledger.apply(store, onion, 2.0, "ORDER_DONE", "ORDER_REQUEST", 9L);
        assertNull(savedLots().get(0).getExpiryDate());
    }

    @Test
    void consumptionTakesEarliestExpiryFirstAndNoExpiryLast() {
        LocalDate d = LocalDate.now();
        InventoryLot later = lot("5", d.plusDays(3), 5);
        InventoryLot sooner = lot("3", d.plusDays(1), 1);
        InventoryLot noExpiry = lot("2", null, 9);
        when(lotRepo.findOpenFifo(60006L, 1L)).thenReturn(new ArrayList<>(List.of(later, noExpiry, sooner)));
        stock(10.0);
        ledger.set(store, onion, 6.0, "SALE", "SALES_DATA", 3L);   // 4 소모
        assertEquals(0, sooner.getRemainingQty().signum());
        assertEquals(new BigDecimal("4"), later.getRemainingQty().stripTrailingZeros());
        assertEquals(new BigDecimal("2"), noExpiry.getRemainingQty());
    }

    @Test
    void upwardAdjustAddsNoExpiryCorrectionLot() {
        when(lotRepo.findOpenFifo(60006L, 1L)).thenReturn(new ArrayList<>(List.of(lot("1", LocalDate.now(), 1))));
        stock(1.0);
        ledger.set(store, onion, 3.5, "ADJUST", "INVENTORY", 1L);
        List<InventoryLot> lots = savedLots();
        InventoryLot correction = lots.get(lots.size() - 1);
        assertNull(correction.getExpiryDate());
        assertEquals(new BigDecimal("2.500"), correction.getRemainingQty());
        assertEquals(60006L, correction.getStoreId());
    }

    @Test
    void negativeStockEmptiesLots() {
        InventoryLot only = lot("1", LocalDate.now(), 1);
        when(lotRepo.findOpenFifo(60006L, 1L)).thenReturn(new ArrayList<>(List.of(only)));
        stock(1.0);
        ledger.set(store, onion, -2.0, "SALE", "SALES_DATA", 3L);   // 부족분은 재고에만 음수로
        assertEquals(0, only.getRemainingQty().signum());
        assertEquals(1, savedLots().size());                         // 보정 로트 없음
    }

    @Test
    void oneSaleWritesOneRowPerRecipeIngredient() {
        Ingredient cheese = new Ingredient();
        cheese.setId(2L);
        cheese.setUnit("kg");
        Menu menu = new Menu();
        menu.setId(100L);
        MenuIngredient a = recipe(onion, "0.05", "kg", "0");
        MenuIngredient b = recipe(cheese, "30", "g", "10");    // g → kg, 오차 10%

        MenuIngredientRepository miRepo = mock(MenuIngredientRepository.class);
        when(miRepo.findByMenuId(100L)).thenReturn(List.of(a, b));
        StoreRepository storeRepo = mock(StoreRepository.class);
        when(storeRepo.findById(60006L)).thenReturn(Optional.of(store));
        MenuRepository menuRepo = mock(MenuRepository.class);
        when(menuRepo.findById(100L)).thenReturn(Optional.of(menu));
        SalesDataRepository salesRepo = mock(SalesDataRepository.class);
        when(salesRepo.save(any())).thenAnswer(inv -> { SalesData s = inv.getArgument(0); s.setId(77L); return s; });
        stock(10.0);
        when(invRepo.findByStoreIdAndIngredientId(60006L, 2L)).thenReturn(Optional.empty());

        new SalesDataService(salesRepo, storeRepo, menuRepo, miRepo, invRepo, ledger)
                .create(60006L, 100L, 4, 40000, LocalDate.now());

        ArgumentCaptor<InventoryTxn> c = ArgumentCaptor.forClass(InventoryTxn.class);
        verify(txnRepo, times(2)).save(c.capture());
        List<InventoryTxn> rows = c.getAllValues();
        assertEquals(-0.2, rows.get(0).getDeltaQty().doubleValue(), 1e-9);    // 0.05kg × 4
        assertEquals(-0.13, rows.get(1).getDeltaQty().doubleValue(), 1e-9);   // 30g × 4 × 1.1 = 0.132kg → round2
        assertTrue(rows.stream().allMatch(t -> "SALE".equals(t.getReason()) && t.getRefId() == 77L));
    }

    private static MenuIngredient recipe(Ingredient ing, String qty, String unit, String tol) {
        MenuIngredient mi = new MenuIngredient();
        mi.setIngredient(ing);
        mi.setQtyPerUnit(new BigDecimal(qty));
        mi.setUnit(unit);
        mi.setTolerance(new BigDecimal(tol));
        return mi;
    }
}
