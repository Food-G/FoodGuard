package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.*;
import com.foodguard.service.OrderRequestService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class OrderRequestServiceTest extends IntegrationTest {

    @Autowired private OrderRequestService service;

    private Store store;
    private Ingredient beef;

    @BeforeEach
    void setUp() {
        store = store(user("OWNER"));
        beef = ingredient("kg", 5);
    }

    private double qty() {
        return inventories.findByStoreIdAndIngredientId(store.getId(), beef.getId()).orElseThrow().getCurrentQty().doubleValue();
    }

    private List<InventoryTxn> ledger() {
        return txns.search(store.getId(), LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1), beef.getId());
    }

    @Test
    void rejectsStatusOutsideTheSevenAllowed() {
        OrderRequest o = service.create(store.getId(), beef.getId(), 3.0);
        for (String bad : new String[]{"DELETED", "done", "SHIPPED", ""}) {
            assertThrows(IllegalStateException.class, () -> service.updateStatus(o.getId(), bad));
        }
        assertEquals("REQUESTED", orders.findById(o.getId()).orElseThrow().getStatus());
    }

    @Test
    void allowsEverySevenStatuses() {
        for (String s : new String[]{"REQUESTED", "APPROVED", "HQ_SENT", "DRIVER_RECEIVED", "REJECTED", "CANCELLED", "DONE"}) {
            OrderRequest o = service.create(store.getId(), beef.getId(), 1.0);
            assertEquals(s, service.updateStatus(o.getId(), s).getStatus());
        }
    }

    @Test
    void doneIncreasesStockExactlyOnceAndWritesLedgerAndLot() {
        stock(store, beef, 2.0);
        OrderRequest o = service.create(store.getId(), beef.getId(), 3.5);
        assertEquals(2.0, qty(), 1e-9);   // 발주 생성·승인으로는 재고가 늘지 않는다

        service.updateStatus(o.getId(), "APPROVED");
        assertEquals(2.0, qty(), 1e-9);

        service.updateStatus(o.getId(), "DONE");
        service.updateStatus(o.getId(), "DONE");
        assertEquals(5.5, qty(), 1e-9);

        List<InventoryTxn> rows = ledger();
        assertEquals(1, rows.size());
        assertEquals("ORDER_DONE", rows.get(0).getReason());
        assertEquals(o.getId(), rows.get(0).getRefId());
        assertEquals(3.5, rows.get(0).getDeltaQty().doubleValue(), 1e-9);

        List<InventoryLot> open = lots.findOpenFifo(store.getId(), beef.getId());
        // 입고 로트(5일 뒤 만료) + 합계를 재고에 맞추는 보정 로트(기한 없음, 맨 뒤)
        assertEquals(LocalDate.now().plusDays(5), open.get(0).getExpiryDate());
        assertEquals(3.5, open.get(0).getRemainingQty().doubleValue(), 1e-9);
        assertEquals(5.5, open.stream().mapToDouble(l -> l.getRemainingQty().doubleValue()).sum(), 1e-9);
    }

    @Test
    void approveIssuesDeliveryToken() {
        OrderRequest o = service.create(store.getId(), beef.getId(), 1.0);
        OrderRequest approved = service.updateStatus(o.getId(), "APPROVED");
        assertNotNull(approved.getDeliveryToken());
        assertNotNull(approved.getApprovedAt());
    }

    @Test
    void approvedOrderCannotBeCancelled() {
        OrderRequest o = service.create(store.getId(), beef.getId(), 1.0);
        service.updateStatus(o.getId(), "APPROVED");
        assertThrows(IllegalStateException.class, () -> service.cancel(o.getId()));
        assertEquals("APPROVED", orders.findById(o.getId()).orElseThrow().getStatus());
    }

    @Test
    void requestedOrderCanBeCancelledWithoutTouchingStock() {
        stock(store, beef, 2.0);
        OrderRequest o = service.create(store.getId(), beef.getId(), 1.0);
        service.cancel(o.getId());
        assertEquals("CANCELLED", orders.findById(o.getId()).orElseThrow().getStatus());
        assertEquals(2.0, qty(), 1e-9);
    }
}
