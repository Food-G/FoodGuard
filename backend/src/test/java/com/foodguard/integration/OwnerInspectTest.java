package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 발주 화면의 '검수' 버튼은 PUT /api/orders/{id}/status {status: DONE} 을 부른다. */
class OwnerInspectTest extends IntegrationTest {

    private OrderRequest order(Store s, Ingredient i, String status) {
        OrderRequest o = new OrderRequest();
        o.setStore(s);
        o.setIngredient(i);
        o.setQuantity(4.0);
        o.setStatus(status);
        o.setOrderedAt(LocalDateTime.now());
        return orders.save(o);
    }

    @Test
    void ownerCompletesDeliveredOrderAndStockGoesUp() throws Exception {
        User owner = user("OWNER");
        Store store = store(owner);
        Ingredient lettuce = ingredient("kg", null);
        OrderRequest o = order(store, lettuce, "DRIVER_RECEIVED");

        putAs(owner, "/api/orders/" + o.getId() + "/status", Map.of("status", "DONE")).andExpect(status().isOk());

        assertEquals("DONE", orders.findById(o.getId()).orElseThrow().getStatus());
        assertEquals(4.0, inventories.findByStoreIdAndIngredientId(store.getId(), lettuce.getId()).orElseThrow()
                .getCurrentQty().doubleValue(), 1e-9);
    }

    @Test
    void ownerCannotApproveOrSkipDelivery() throws Exception {
        User owner = user("OWNER");
        Store store = store(owner);
        Ingredient lettuce = ingredient("kg", null);
        OrderRequest requested = order(store, lettuce, "REQUESTED");
        OrderRequest sent = order(store, lettuce, "HQ_SENT");

        putAs(owner, "/api/orders/" + requested.getId() + "/status", Map.of("status", "APPROVED")).andExpect(status().isForbidden());
        putAs(owner, "/api/orders/" + sent.getId() + "/status", Map.of("status", "DONE")).andExpect(status().isForbidden());
        assertEquals("REQUESTED", orders.findById(requested.getId()).orElseThrow().getStatus());
    }

    @Test
    void ownerCannotInspectAnotherStoresOrder() throws Exception {
        User owner = user("OWNER");
        store(owner);
        Store other = store(user("OWNER"));
        OrderRequest o = order(other, ingredient("kg", null), "DRIVER_RECEIVED");

        putAs(owner, "/api/orders/" + o.getId() + "/status", Map.of("status", "DONE")).andExpect(status().isForbidden());
    }
}
