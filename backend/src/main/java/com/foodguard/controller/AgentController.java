package com.foodguard.controller;

import com.foodguard.entity.AgentProposal;
import com.foodguard.entity.AgentRun;
import com.foodguard.repository.AgentRunRepository;
import com.foodguard.security.AuthUser;
import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.AgentProposalService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 에이전트 제안 큐 + 실행 기록 (DEV_ROADMAP AG-0).
 *
 * 생성(POST proposals / runs)은 AGENT 계정만, 조회는 OWNER(자기 매장)·HQ·AGENT,
 * 승인·거절은 그 매장 OWNER 또는 HQ 만 한다. AGENT 의 그 밖의 쓰기는 SecurityConfig 가 막는다.
 */
@RestController
@RequestMapping("/api/agent")
@RequiredArgsConstructor
public class AgentController {

    private final AgentProposalService proposalService;
    private final AgentRunRepository runRepository;
    private final StoreAccessGuard guard;
    private final RestTemplate restTemplate;

    @Value("${agent.service.url:http://localhost:8100}")
    private String agentServiceUrl;

    // ── 제안 ─────────────────────────────────────────────────────────

    @PreAuthorize("hasRole('AGENT')")
    @PostMapping("/proposals")
    public ResponseEntity<AgentProposal> createProposal(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(proposalService.create(body));
    }

    @GetMapping("/proposals")
    public ResponseEntity<List<AgentProposal>> listProposals(@RequestParam(required = false) Long storeId,
                                                             @RequestParam(required = false) String status,
                                                             @RequestParam(required = false) String type) {
        assertStoreOrAll(storeId);
        return ResponseEntity.ok(proposalService.search(storeId, status, type));
    }

    @PostMapping("/proposals/{id}/approve")
    public ResponseEntity<AgentProposal> approve(@PathVariable Long id) {
        guard.assertCanAccessStore(proposalService.get(id).getStoreId());
        return ResponseEntity.ok(proposalService.approve(id, guard.currentUser().id()));
    }

    @PostMapping("/proposals/{id}/reject")
    public ResponseEntity<AgentProposal> reject(@PathVariable Long id,
                                                @RequestBody(required = false) Map<String, Object> body) {
        guard.assertCanAccessStore(proposalService.get(id).getStoreId());
        String reason = body != null && body.get("reason") != null ? body.get("reason").toString() : null;
        return ResponseEntity.ok(proposalService.reject(id, guard.currentUser().id(), reason));
    }

    // ── 실행 기록 ────────────────────────────────────────────────────

    @PreAuthorize("hasRole('AGENT')")
    @PostMapping("/runs")
    public ResponseEntity<AgentRun> startRun(@RequestBody Map<String, Object> body) {
        AgentRun run = new AgentRun();
        run.setRunId(String.valueOf(body.get("runId")));
        run.setAgent(String.valueOf(body.get("agent")));
        run.setStoreId(body.get("storeId") != null ? Long.valueOf(body.get("storeId").toString()) : null);
        run.setTriggerType(String.valueOf(body.getOrDefault("triggerType", "MANUAL")));
        run.setModel(body.get("model") != null ? body.get("model").toString() : null);
        run.setStatus("RUNNING");
        run.setStartedAt(LocalDateTime.now());
        return ResponseEntity.ok(runRepository.save(run));
    }

    @PreAuthorize("hasRole('AGENT')")
    @PutMapping("/runs/{runId}")
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<AgentRun> finishRun(@PathVariable String runId, @RequestBody Map<String, Object> body) {
        AgentRun run = runRepository.findById(runId)
                .orElseThrow(() -> new IllegalStateException("실행 기록을 찾을 수 없습니다: " + runId));
        run.setStatus(String.valueOf(body.getOrDefault("status", "OK")));
        if (body.get("model") != null) run.setModel(body.get("model").toString());
        if (body.get("inputTokens") != null) run.setInputTokens(((Number) body.get("inputTokens")).intValue());
        if (body.get("outputTokens") != null) run.setOutputTokens(((Number) body.get("outputTokens")).intValue());
        if (body.get("result") instanceof Map<?, ?> m) run.setResultJson((Map<String, Object>) m);
        if (body.get("error") != null) run.setError(body.get("error").toString());
        run.setFinishedAt(LocalDateTime.now());
        return ResponseEntity.ok(runRepository.save(run));
    }

    @GetMapping("/runs")
    public ResponseEntity<List<AgentRun>> listRuns(@RequestParam(required = false) String agent,
                                                   @RequestParam(required = false) Long storeId) {
        assertStoreOrAll(storeId);
        return ResponseEntity.ok(runRepository.search(agent, storeId));
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<AgentRun> getRun(@PathVariable String runId) {
        AgentRun run = runRepository.findById(runId)
                .orElseThrow(() -> new IllegalStateException("실행 기록을 찾을 수 없습니다: " + runId));
        assertStoreOrAll(run.getStoreId());
        return ResponseEntity.ok(run);
    }

    // ── 수동 실행 (사람 → Spring → agent-service, 내부 토큰은 RestTemplate 인터셉터가 붙인다) ──

    @PostMapping("/run/{agent}/{storeId}")
    public ResponseEntity<?> runAgent(@PathVariable String agent, @PathVariable Long storeId) {
        if (!agent.matches("[a-z_]{1,30}")) {
            return ResponseEntity.badRequest().body(Map.of("message", "잘못된 에이전트 이름입니다."));
        }
        guard.assertCanAccessStore(storeId);
        try {
            return ResponseEntity.accepted().body(restTemplate.postForObject(
                    agentServiceUrl + "/run/" + agent + "?storeId=" + storeId + "&trigger=MANUAL", null, Map.class));
        } catch (RestClientException e) {
            return ResponseEntity.status(502).body(Map.of("status", "error",
                    "message", "에이전트 서비스 호출 실패: " + e.getMessage()));
        }
    }

    /** storeId 가 있으면 매장 검사, 없으면(전 매장) HQ·AGENT 만. */
    private void assertStoreOrAll(Long storeId) {
        if (storeId != null) {
            guard.assertCanAccessStore(storeId);
            return;
        }
        AuthUser user = guard.currentUser();
        if (!user.isHqAdmin() && !user.isAgent()) {
            throw new AccessDeniedException("전 매장 조회는 본사만 할 수 있습니다.");
        }
    }
}
