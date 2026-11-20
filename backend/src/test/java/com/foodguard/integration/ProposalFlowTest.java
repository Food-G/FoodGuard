package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.*;
import com.foodguard.repository.AgentProposalRepository;
import com.foodguard.repository.WasteRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 제안 → 승인 → 실행. JSON 컬럼 왕복, REQUIRES_NEW 트랜잭션, 롤백을 실제 DB 로 확인한다 (AG-0~AG-8). */
class ProposalFlowTest extends IntegrationTest {

    @Autowired private AgentProposalRepository proposals;
    @Autowired private WasteRecordRepository wasteRecords;

    private User owner, hq, agent;
    private Store store;
    private Ingredient onion;

    @BeforeEach
    void setUp() {
        owner = user("OWNER");
        hq = user("HQ_ADMIN");
        agent = user("AGENT");
        store = store(owner);
        onion = ingredient("kg", null);
    }

    private long propose(String type, Map<String, Object> payload, String fingerprint) throws Exception {
        Map<String, Object> body = new HashMap<>(Map.of("runId", "run-1", "agent", "test", "storeId", store.getId(),
                "type", type, "payload", payload, "rationale", "이유"));
        if (fingerprint != null) body.put("fingerprint", fingerprint);
        String res = postAs(agent, "/api/agent/proposals", body).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(res).get("id").asLong();
    }

    private String statusOf(long id) {
        return proposals.findById(id).orElseThrow().getStatus();
    }

    private Map<String, Object> wasteItem(Ingredient i, double qty) {
        return Map.of("ingredientId", i.getId(), "qty", qty, "reason", "EXPIRED");
    }

    @Test
    void unknownTypeIsRefused() throws Exception {
        postAs(agent, "/api/agent/proposals", Map.of("runId", "r", "agent", "t", "storeId", store.getId(),
                "type", "DROP_TABLE", "payload", Map.of(), "rationale", "이유")).andExpect(status().isBadRequest());
    }

    @Test
    void jsonPayloadSurvivesRoundTripAndListsByFilter() throws Exception {
        long id = propose("AUDIT_REPORT", Map.of("items", List.of(Map.of("severity", "high", "title", "한글 제목"))), null);
        getAs(owner, "/api/agent/proposals?storeId=" + store.getId() + "&status=PENDING&type=AUDIT_REPORT")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].payload.items[0].title").value("한글 제목"));
    }

    @Test
    void infoCardApprovalChangesNothing() throws Exception {
        long id = propose("WEEKLY_BRIEFING", Map.of("asOf", "2026-11-09"), null);
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXECUTED"))
                .andExpect(jsonPath("$.decidedBy").value(owner.getId()));
    }

    @Test
    void alreadyDecidedProposalCannotBeDecidedAgain() throws Exception {
        long id = propose("AUDIT_REPORT", Map.of(), null);
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isOk());
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isBadRequest());
        postAs(owner, "/api/agent/proposals/" + id + "/reject", Map.of()).andExpect(status().isBadRequest());
    }

    @Test
    void rejectStoresReason() throws Exception {
        long id = propose("DISCOUNT_SUGGEST", Map.of("items", List.of()), null);
        postAs(owner, "/api/agent/proposals/" + id + "/reject", Map.of("reason", "이번 주는 안 함"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.execResult.reason").value("이번 주는 안 함"));
    }

    @Test
    void expiredProposalCannotBeApproved() throws Exception {
        long id = propose("AUDIT_REPORT", Map.of(), null);
        AgentProposal p = proposals.findById(id).orElseThrow();
        p.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        proposals.save(p);
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isBadRequest());
        assertEquals("PENDING", statusOf(id));
    }

    @Test
    void discountApprovalNotifiesOwner() throws Exception {
        long id = propose("DISCOUNT_SUGGEST", Map.of("items", List.of(Map.of("ingredientName", "양상추", "menus", "샐러드"))), null);
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(jsonPath("$.status").value("EXECUTED"));
        getAs(owner, "/api/notifications/" + store.getId() + "/unread").andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value(containsString("양상추(샐러드)")));
    }

    // ── 폐기 등록 제안 ───────────────────────────────────────────────

    @Test
    void wasteProposalDisposesExpiredStock() throws Exception {
        stock(store, onion, 5);
        lot(store, onion, 2, -1);
        lot(store, onion, 3, 4);
        long id = propose("WASTE_RECORD", Map.of("items", List.of(wasteItem(onion, 2))), null);

        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("EXECUTED"))
                .andExpect(jsonPath("$.execResult.records[0].wasteId").isNumber());

        assertEquals(3.0, inventories.findByStoreIdAndIngredientId(store.getId(), onion.getId()).orElseThrow().getCurrentQty().doubleValue(), 1e-9);
        // 만료 로트만 비고 멀쩡한 로트는 그대로다
        List<InventoryLot> left = lots.findOpenFifo(store.getId(), onion.getId());
        assertEquals(1, left.size());
        assertEquals(LocalDate.now().plusDays(4), left.get(0).getExpiryDate());
    }

    @Test
    void wasteProposalIsStaleWhenExpiredStockShrankAndChangesNothing() throws Exception {
        stock(store, onion, 5);
        lot(store, onion, 1, -1);
        lot(store, onion, 4, 4);
        long id = propose("WASTE_RECORD", Map.of("items", List.of(wasteItem(onion, 2))), null);

        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("STALE"));

        assertEquals(5.0, inventories.findByStoreIdAndIngredientId(store.getId(), onion.getId()).orElseThrow().getCurrentQty().doubleValue(), 1e-9);
    }

    @Test
    void failureMidwayRollsBackEveryItem() throws Exception {
        Ingredient second = ingredient("kg", null);
        stock(store, onion, 5);
        lot(store, onion, 2, -1);
        stock(store, second, 1);
        lot(store, second, 1, -1);
        long before = wasteRecords.count();
        // 두 번째 항목은 사유가 잘못되어 실패한다. 첫 항목의 폐기도 함께 취소돼야 한다
        long id = propose("WASTE_RECORD", Map.of("items", List.of(wasteItem(onion, 2),
                Map.of("ingredientId", second.getId(), "qty", 1, "reason", "NOPE"))), null);

        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.execResult.error").isNotEmpty());

        assertEquals(before, wasteRecords.count());
        assertEquals(5.0, inventories.findByStoreIdAndIngredientId(store.getId(), onion.getId()).orElseThrow().getCurrentQty().doubleValue(), 1e-9);
    }

    // ── 외부 서비스가 필요한 제안 (테스트에는 서비스가 없다) ─────────────

    @Test
    void orderProposalStaysPendingWhenAgentServiceIsDown() throws Exception {
        long id = propose("ORDER_CREATE", Map.of("items", List.of(Map.of("ingredientId", onion.getId(), "orderQty", 1))), "plan1");
        long before = orders.count();

        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isBadRequest());

        assertEquals("PENDING", statusOf(id));   // 다시 승인할 수 있어야 한다
        assertEquals(before, orders.count());
    }

    @Test
    void modelPromoteIsHqOnlyAndStaysPendingWhenAiServiceIsDown() throws Exception {
        long id = propose("MODEL_PROMOTE", Map.of("championWape", 0.2), "c1");
        postAs(owner, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isForbidden());
        postAs(owner, "/api/agent/proposals/" + id + "/reject", Map.of()).andExpect(status().isForbidden());
        postAs(hq, "/api/agent/proposals/" + id + "/approve", Map.of()).andExpect(status().isBadRequest());
        assertEquals("PENDING", statusOf(id));
    }

    @Test
    void modelStatusAndChatReport502WhenServicesAreDown() throws Exception {
        getAs(owner, "/api/predictions/" + store.getId() + "/model-status").andExpect(status().isBadGateway());
        postAs(owner, "/api/agent/chat", Map.of("question", "폐기 위험", "storeId", store.getId()))
                .andExpect(status().isBadGateway()).andExpect(jsonPath("$.message").isNotEmpty());
    }

    // ── 실행 기록 ────────────────────────────────────────────────────

    @Test
    void runRecordKeepsJsonResultAndIsScopedToStore() throws Exception {
        User other = user("OWNER");
        String runId = java.util.UUID.randomUUID().toString();
        postAs(agent, "/api/agent/runs", Map.of("runId", runId, "agent", "audit", "storeId", store.getId(), "triggerType", "CHAT"))
                .andExpect(status().isOk());
        putAs(agent, "/api/agent/runs/" + runId, Map.of("status", "OK", "inputTokens", 10, "outputTokens", 5,
                "result", Map.of("decision", Map.of("findings", List.of(Map.of("severity", "high"))))))
                .andExpect(status().isOk());

        getAs(owner, "/api/agent/runs?agent=audit&storeId=" + store.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].runId").value(runId))
                .andExpect(jsonPath("$[0].resultJson.decision.findings[0].severity").value("high"));
        getAs(other, "/api/agent/runs/" + runId).andExpect(status().isForbidden());
    }

    @Test
    void runProgressIsAppendedWhileRunningAndKeptAfterFinish() throws Exception {
        String runId = java.util.UUID.randomUUID().toString();
        postAs(agent, "/api/agent/runs", Map.of("runId", runId, "agent", "echo", "storeId", store.getId()))
                .andExpect(status().isOk());
        putAs(agent, "/api/agent/runs/" + runId + "/progress", Map.of("phase", "observe")).andExpect(status().isOk());
        putAs(agent, "/api/agent/runs/" + runId + "/progress", Map.of("phase", "llm")).andExpect(status().isOk());
        putAs(agent, "/api/agent/runs/" + runId + "/progress", Map.of("phase", "drop table")).andExpect(status().isBadRequest());
        putAs(owner, "/api/agent/runs/" + runId + "/progress", Map.of("phase", "notify")).andExpect(status().isForbidden());

        getAs(owner, "/api/agent/runs/" + runId).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RUNNING"))
                .andExpect(jsonPath("$.resultJson.progress[*].phase").value(contains("observe", "llm")))
                .andExpect(jsonPath("$.resultJson.progress[0].at").isNotEmpty());

        putAs(agent, "/api/agent/runs/" + runId, Map.of("status", "OK", "result", Map.of("decision", Map.of())))
                .andExpect(status().isOk());
        getAs(owner, "/api/agent/runs/" + runId)
                .andExpect(jsonPath("$.resultJson.decision").exists())
                .andExpect(jsonPath("$.resultJson.progress", hasSize(2)));
        putAs(agent, "/api/agent/runs/" + runId + "/progress", Map.of("phase", "notify")).andExpect(status().isConflict());
    }

    // ── 알림 ─────────────────────────────────────────────────────────

    @Test
    void agentNotificationIsDeduplicatedForTwentyFourHours() throws Exception {
        Map<String, Object> n = Map.of("storeId", store.getId(), "type", "ORDER", "message", "같은 문구");
        postAs(agent, "/api/notifications", n).andExpect(status().isOk()).andExpect(jsonPath("$.createdAt").isNotEmpty());
        postAs(agent, "/api/notifications", n).andExpect(status().isOk()).andExpect(jsonPath("$.deduplicated").value(true));
        getAs(owner, "/api/notifications/" + store.getId() + "/unread").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void hqNotificationReachesHqButNotOwner() throws Exception {
        Map<String, Object> n = Map.of("storeId", store.getId(), "type", "ORDER", "audience", "HQ", "message", "본사 문구 " + hq.getId());
        postAs(agent, "/api/notifications", n).andExpect(status().isOk()).andExpect(jsonPath("$.created").value(greaterThanOrEqualTo(1)));
        getAs(owner, "/api/notifications/" + store.getId() + "/unread").andExpect(jsonPath("$", hasSize(0)));
        getAs(hq, "/api/notifications/hq/unread").andExpect(status().isOk())
                .andExpect(jsonPath("$[*].message", hasItem("본사 문구 " + hq.getId())));
    }
}
