package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 폐기 기록·폐기율·만료분 폐기 제안 (DB·Spring 컨텍스트 없음). */
class WasteServiceTest {

    private static final Long STORE = 60006L;

    private WasteRecordRepository wasteRepo;
    private InventoryRepository invRepo;
    private InventoryTxnRepository txnRepo;
    private IngredientRepository ingRepo;
    private InventoryLotRepository lotRepo;
    private InventoryLedger ledger;
    private WasteService service;
    private Store store;
    private Ingredient onion;

    @BeforeEach
    void setUp() {
        wasteRepo = mock(WasteRecordRepository.class);
        invRepo = mock(InventoryRepository.class);
        txnRepo = mock(InventoryTxnRepository.class);
        ingRepo = mock(IngredientRepository.class);
        lotRepo = mock(InventoryLotRepository.class);
        ledger = mock(InventoryLedger.class);
        StoreRepository storeRepo = mock(StoreRepository.class);
        service = new WasteService(wasteRepo, storeRepo, ingRepo, invRepo, txnRepo, ledger);

        store = new Store();
        store.setId(STORE);
        onion = new Ingredient();
        onion.setId(1L);
        onion.setName("양파");
        onion.setUnit("kg");
        when(storeRepo.findById(STORE)).thenReturn(Optional.of(store));
        when(ingRepo.findById(1L)).thenReturn(Optional.of(onion));
        when(wasteRepo.save(any())).thenAnswer(inv -> {
            WasteRecord w = inv.getArgument(0);
            w.setId(77L);
            return w;
        });
        Inventory inv = new Inventory();
        inv.setQuantity(5.3);
        when(invRepo.findByStoreIdAndIngredientId(STORE, 1L)).thenReturn(Optional.of(inv));
    }

    @Test
    void recordSavesRowAndGoesThroughLedger() {
        WasteRecord w = service.record(STORE, 1L, 2.1, "EXPIRED");

        assertEquals(new BigDecimal("2.1"), w.getQty());
        assertEquals("양파", w.getIngredientName());
        assertEquals("kg", w.getUnit());
        assertEquals(LocalDate.now(), w.getWasteDate());
        // 부동소수 오차 없이 3.2, 원장 참조는 저장된 폐기 기록
        verify(ledger).set(store, onion, 3.2, "WASTE", "WASTE_RECORD", 77L);
    }

    @Test
    void rejectsBadInputWithoutTouchingStock() {
        assertThrows(IllegalStateException.class, () -> service.record(STORE, 1L, 1, "LOST"));
        assertThrows(IllegalStateException.class, () -> service.record(STORE, 1L, 0, "OTHER"));
        assertThrows(IllegalStateException.class, () -> service.record(STORE, 1L, -1, "OTHER"));
        assertThrows(IllegalStateException.class, () -> service.record(STORE, 1L, 5.31, "OTHER"));
        verifyNoInteractions(ledger);
        verify(wasteRepo, never()).save(any());
    }

    @Test
    void canWasteAllStock() {
        service.record(STORE, 1L, 5.3, "DAMAGED");
        verify(ledger).set(store, onion, 0.0, "WASTE", "WASTE_RECORD", 77L);
    }

    @Test
    void wasteRateIsWastedOverReceivedPerIngredient() {
        Ingredient beef = new Ingredient();
        beef.setId(2L);
        beef.setName("소고기");
        beef.setUnit("kg");
        when(ingRepo.findAllById(any())).thenReturn(List.of(onion, beef));
        when(txnRepo.sumWasteAndReceived(eq(STORE), any(), any())).thenReturn(List.of(
                new Object[]{1L, "WASTE", new BigDecimal("-2.5")},
                new Object[]{1L, "ORDER_DONE", new BigDecimal("10")},
                new Object[]{2L, "WASTE", new BigDecimal("-1")}));

        List<Map<String, Object>> rows = service.wasteRate(STORE, LocalDate.now().minusDays(7), LocalDate.now());

        assertEquals(25.0, rows.get(0).get("wasteRate"));
        assertEquals(2.5, rows.get(0).get("wasteQty"));
        assertEquals(10.0, rows.get(0).get("receivedQty"));
        assertNull(rows.get(1).get("wasteRate"));   // 입고가 없으면 비율을 낼 수 없다
    }

    // ── 만료분 폐기 제안 ─────────────────────────────────────────────

    private ProposalExecutor executor() {
        return new ProposalExecutor(mock(OrderRequestService.class), mock(NotificationService.class),
                service, lotRepo, mock(RestTemplate.class));
    }

    private AgentProposal wasteProposal(double qty) {
        AgentProposal p = new AgentProposal();
        p.setType("WASTE_RECORD");
        p.setStoreId(STORE);
        p.setPayload(Map.of("items", List.of(Map.of("ingredientId", 1, "qty", qty, "reason", "EXPIRED"))));
        return p;
    }

    private void lots(double expired, double fresh) {
        InventoryLot old = new InventoryLot();
        old.setRemainingQty(BigDecimal.valueOf(expired));
        old.setExpiryDate(LocalDate.now().minusDays(1));
        InventoryLot today = new InventoryLot();
        today.setRemainingQty(BigDecimal.valueOf(fresh));
        today.setExpiryDate(LocalDate.now());   // 오늘 기한은 아직 만료가 아니다
        when(lotRepo.findOpenFifo(STORE, 1L)).thenReturn(List.of(old, today));
    }

    @Test
    void wasteProposalRecordsExpiredQty() {
        lots(2.0, 3.3);
        Map<String, Object> result = executor().execute(wasteProposal(2.0));
        assertEquals(true, result.get("ok"));
        verify(ledger).set(store, onion, 3.3, "WASTE", "WASTE_RECORD", 77L);
    }

    @Test
    void wasteProposalIsStaleWhenExpiredStockShrank() {
        lots(1.0, 4.3);   // 제안 2kg 인데 만료분은 이제 1kg — 나머지는 멀쩡한 재고다
        assertThrows(ProposalExecutor.StaleProposalException.class, () -> executor().execute(wasteProposal(2.0)));
        verifyNoInteractions(ledger);
    }
}
