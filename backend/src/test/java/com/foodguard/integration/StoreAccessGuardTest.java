package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.*;
import com.foodguard.repository.DonationRecordRepository;
import com.foodguard.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 실제 JWT 로 필터·SecurityConfig·StoreAccessGuard·@PreAuthorize 를 그대로 탄다. */
class StoreAccessGuardTest extends IntegrationTest {

    @Autowired private DonationRecordRepository donations;
    @Autowired private NotificationRepository notifications;

    private User owner, otherOwner, hq, agent;
    private Store store, otherStore;
    private Ingredient onion;
    private Inventory otherStock;

    @BeforeEach
    void setUp() {
        owner = user("OWNER");
        otherOwner = user("OWNER");
        hq = user("HQ_ADMIN");
        agent = user("AGENT");
        store = store(owner);
        otherStore = store(otherOwner);
        onion = ingredient("kg", null);
        stock(store, onion, 5);
        otherStock = stock(otherStore, onion, 5);
    }

    @Test
    void anonymousIsRefused() throws Exception {
        getAs(null, "/api/inventory/" + store.getId()).andExpect(status().isForbidden());
    }

    @Test
    void forgedTokenIsTreatedAsAnonymous() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/api/inventory/" + store.getId()).header("Authorization", "Bearer forged.token.value"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ownerReadsOnlyOwnStore() throws Exception {
        getAs(owner, "/api/inventory/" + store.getId()).andExpect(status().isOk());
        for (String path : List.of("/api/inventory/%d", "/api/orders/%d", "/api/sales/%d", "/api/menus/%d",
                "/api/inventory/%d/txns", "/api/inventory/%d/lots", "/api/waste/%d", "/api/waste/%d/rate",
                "/api/waste-prediction/%d", "/api/waste-prediction/%d/summary", "/api/donations/store/%d",
                "/api/predictions/%d", "/api/predictions/%d/model-status", "/api/notifications/%d/unread")) {
            getAs(owner, path.formatted(otherStore.getId())).andExpect(status().isForbidden());
        }
    }

    @Test
    void hqPassesStoreChecks() throws Exception {
        getAs(hq, "/api/inventory/" + otherStore.getId()).andExpect(status().isOk());
        getAs(hq, "/api/orders/admin/all").andExpect(status().isOk());
    }

    @Test
    void entityIdCannotReachAnotherStore() throws Exception {
        OrderRequest order = new OrderRequest();
        order.setStore(otherStore);
        order.setIngredient(onion);
        order.setQuantity(1.0);
        order.setStatus("REQUESTED");
        order.setOrderedAt(LocalDateTime.now());
        order = orders.save(order);

        DonationRecord d = new DonationRecord();
        d.setStoreId(otherStore.getId());
        d.setIngredientId(onion.getId());
        d.setQuantity(BigDecimal.ONE);
        d.setDonationType("INGREDIENT");
        d.setOrgName("기관");
        d.setOrgType("FOOD_BANK");
        d.setStatus("PLANNED");
        d = donations.save(d);

        Notification n = new Notification();
        n.setUser(otherOwner);
        n.setStore(otherStore);
        n.setMessage("m");
        n.setType("ORDER");
        n = notifications.save(n);

        putAs(owner, "/api/inventory/" + otherStock.getId(), Map.of("quantity", 0)).andExpect(status().isForbidden());
        deleteAs(owner, "/api/inventory/" + otherStock.getId()).andExpect(status().isForbidden());
        putAs(owner, "/api/orders/" + order.getId() + "/status", Map.of("status", "DONE")).andExpect(status().isForbidden());
        deleteAs(owner, "/api/orders/" + order.getId()).andExpect(status().isForbidden());
        postAs(owner, "/api/donations/" + d.getId() + "/complete", Map.of()).andExpect(status().isForbidden());
        postAs(owner, "/api/donations/" + d.getId() + "/cancel", Map.of()).andExpect(status().isForbidden());
        putAs(owner, "/api/notifications/" + n.getId() + "/read", Map.of()).andExpect(status().isForbidden());
    }

    @Test
    void ownerCannotWriteToAnotherStore() throws Exception {
        Map<String, Object> order = Map.of("storeId", otherStore.getId(), "ingredientId", onion.getId(), "quantity", 1);
        postAs(owner, "/api/orders", order).andExpect(status().isForbidden());
        postAs(owner, "/api/waste/" + otherStore.getId(),
                Map.of("ingredientId", onion.getId(), "quantity", 1, "reason", "OTHER")).andExpect(status().isForbidden());
        postAs(owner, "/api/donations/" + otherStore.getId(), Map.of("ingredientId", onion.getId(), "quantity", 1,
                "donationType", "INGREDIENT", "orgName", "기관", "orgType", "FOOD_BANK")).andExpect(status().isForbidden());
    }

    // ── 에이전트 계정 (R5: 조회 + 제안·실행기록 + 화이트리스트만) ──────

    @Test
    void agentReadsAnyStore() throws Exception {
        getAs(agent, "/api/inventory/" + otherStore.getId()).andExpect(status().isOk());
        getAs(agent, "/api/orders/admin/all").andExpect(status().isOk());
    }

    @Test
    void agentCannotWriteBusinessData() throws Exception {
        long sid = store.getId();
        postAs(agent, "/api/orders", Map.of("storeId", sid, "ingredientId", onion.getId(), "quantity", 1)).andExpect(status().isForbidden());
        postAs(agent, "/api/orders/auto/" + sid, Map.of()).andExpect(status().isForbidden());
        postAs(agent, "/api/sales", Map.of("storeId", sid)).andExpect(status().isForbidden());
        putAs(agent, "/api/inventory/" + otherStock.getId(), Map.of("quantity", 0)).andExpect(status().isForbidden());
        deleteAs(agent, "/api/inventory/" + otherStock.getId()).andExpect(status().isForbidden());
        postAs(agent, "/api/waste/" + sid, Map.of("ingredientId", onion.getId(), "quantity", 1, "reason", "OTHER")).andExpect(status().isForbidden());
        postAs(agent, "/api/donations/" + sid, Map.of("ingredientId", onion.getId())).andExpect(status().isForbidden());
        postAs(agent, "/api/agent/chat", Map.of("question", "q")).andExpect(status().isForbidden());
        postAs(agent, "/api/agent/run/echo/" + sid, Map.of()).andExpect(status().isForbidden());
        postAs(agent, "/api/predictions/" + sid + "/model/rollback?to=x", Map.of()).andExpect(status().isForbidden());
    }

    /** 매장 검사가 없는 전역 쓰기. 여기는 SecurityConfig 의 기본 거부만이 막는다 (새 쓰기 API 도 같은 경로로 막힌다). */
    @Test
    void agentCannotWriteEvenWhereNoStoreCheckExists() throws Exception {
        Map<String, Object> ingredient = Map.of("name", "에이전트가 만든 식자재", "unit", "kg");
        long before = ingredients.count();
        postAs(agent, "/api/ingredients", ingredient).andExpect(status().isForbidden());
        putAs(agent, "/api/ingredients/" + onion.getId(), ingredient).andExpect(status().isForbidden());
        deleteAs(agent, "/api/ingredients/" + onion.getId()).andExpect(status().isForbidden());
        postAs(agent, "/api/stores", Map.of("storeName", "에이전트 매장", "region", "경남", "userId", agent.getId()))
                .andExpect(status().isForbidden());
        org.junit.jupiter.api.Assertions.assertEquals(before, ingredients.count());
        org.junit.jupiter.api.Assertions.assertTrue(ingredients.existsById(onion.getId()));
    }

    @Test
    void agentCannotApproveItsOwnProposal() throws Exception {
        String body = postAs(agent, "/api/agent/proposals", Map.of("runId", "r1", "agent", "echo", "storeId", store.getId(),
                "type", "ORDER_FLAG", "payload", Map.of("a", 1), "rationale", "이유"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long id = json.readTree(body).get("id").asLong();
        postAs(agent, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isForbidden());
        postAs(agent, "/api/agent/proposals/" + id + "/reject", Map.of()).andExpect(status().isForbidden());
    }

    @Test
    void peopleCannotCreateProposalsOrRuns() throws Exception {
        Map<String, Object> proposal = Map.of("runId", "r", "agent", "echo", "storeId", store.getId(),
                "type", "ORDER_FLAG", "payload", Map.of(), "rationale", "이유");
        postAs(owner, "/api/agent/proposals", proposal).andExpect(status().isForbidden());
        postAs(hq, "/api/agent/proposals", proposal).andExpect(status().isForbidden());
        postAs(owner, "/api/agent/runs", Map.of("runId", "r", "agent", "echo")).andExpect(status().isForbidden());
    }

    // ── 본사 전용 ────────────────────────────────────────────────────

    @Test
    void hqOnlyOperationsRefuseOwners() throws Exception {
        long sid = store.getId();
        getAs(owner, "/api/orders/admin/all").andExpect(status().isForbidden());
        getAs(owner, "/api/notifications/hq/unread").andExpect(status().isForbidden());
        postAs(owner, "/api/predictions/" + sid + "/challenger", Map.of()).andExpect(status().isForbidden());
        postAs(owner, "/api/predictions/" + sid + "/model/rollback?to=20260101-000000-000000", Map.of()).andExpect(status().isForbidden());
        postAs(owner, "/api/notifications", Map.of("storeId", sid, "type", "ORDER", "message", "m", "audience", "HQ")).andExpect(status().isForbidden());
        getAs(owner, "/api/agent/proposals").andExpect(status().isForbidden());
        getAs(owner, "/api/agent/runs").andExpect(status().isForbidden());
    }
}
