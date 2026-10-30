package com.foodguard.service;

import com.foodguard.entity.AgentProposal;
import com.foodguard.repository.AgentProposalRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentProposalService {

    static final Set<String> TYPES = Set.of(
            "ORDER_CREATE", "WASTE_RECORD", "DONATION_CREATE", "DISCOUNT_SUGGEST", "MODEL_PROMOTE", "ORDER_FLAG");

    private final AgentProposalRepository proposalRepository;
    private final StoreRepository storeRepository;
    private final ProposalExecutor executor;

    @Transactional
    public AgentProposal create(Map<String, Object> body) {
        String type = String.valueOf(body.get("type"));
        if (!TYPES.contains(type)) throw new IllegalStateException("알 수 없는 제안 타입입니다: " + type);
        Long storeId = Long.valueOf(String.valueOf(body.get("storeId")));
        if (!storeRepository.existsById(storeId)) throw new IllegalStateException("가맹점을 찾을 수 없습니다: " + storeId);
        if (!(body.get("payload") instanceof Map<?, ?> payload)) throw new IllegalStateException("payload 는 객체여야 합니다.");
        Object rationale = body.get("rationale");
        if (rationale == null || rationale.toString().isBlank()) throw new IllegalStateException("rationale 이 필요합니다.");

        AgentProposal p = new AgentProposal();
        p.setRunId(String.valueOf(body.get("runId")));
        p.setAgent(String.valueOf(body.get("agent")));
        p.setStoreId(storeId);
        p.setType(type);
        @SuppressWarnings("unchecked") Map<String, Object> pl = (Map<String, Object>) payload;
        p.setPayload(pl);
        p.setRationale(rationale.toString());
        p.setFingerprint(body.get("fingerprint") != null ? body.get("fingerprint").toString() : null);
        p.setStatus("PENDING");
        // 만료 기본값: 당일 23:59:59 (발주안처럼 그날 데이터 기준 제안이 대부분)
        p.setExpiresAt(body.get("expiresAt") != null
                ? LocalDateTime.parse(body.get("expiresAt").toString())
                : LocalDateTime.of(LocalDate.now(), LocalTime.of(23, 59, 59)));
        p.setCreatedAt(LocalDateTime.now());
        return proposalRepository.save(p);
    }

    public AgentProposal get(Long id) {
        return proposalRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("제안을 찾을 수 없습니다: " + id));
    }

    public List<AgentProposal> search(Long storeId, String status, String type) {
        return proposalRepository.search(storeId, status, type);
    }

    /** 승인 → 즉시 실행. 결과에 따라 EXECUTED / FAILED / STALE. 권한 검사는 컨트롤러가 먼저 한다. */
    @Transactional
    public AgentProposal approve(Long id, Long userId) {
        AgentProposal p = decide(id, userId);
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            result.putAll(executor.execute(p));
            p.setStatus("EXECUTED");
        } catch (ProposalExecutor.CheckUnavailableException e) {
            // 결정을 기록하지 않고 롤백 → 제안은 PENDING 으로 남는다 (400)
            throw new IllegalStateException(e.getMessage());
        } catch (ProposalExecutor.StaleProposalException e) {
            p.setStatus("STALE");
            result.put("error", e.getMessage());
        } catch (RuntimeException e) {
            log.warn("제안 {} 실행 실패: {}", id, e.getMessage());
            p.setStatus("FAILED");
            result.put("error", e.getMessage());
        }
        p.setExecResult(result);
        return proposalRepository.save(p);
    }

    @Transactional
    public AgentProposal reject(Long id, Long userId, String reason) {
        AgentProposal p = decide(id, userId);
        p.setStatus("REJECTED");
        p.setExecResult(Map.of("reason", reason == null ? "" : reason));
        return proposalRepository.save(p);
    }

    private AgentProposal decide(Long id, Long userId) {
        AgentProposal p = get(id);
        if (!"PENDING".equals(p.getStatus())) {
            throw new IllegalStateException("이미 처리된 제안입니다: " + p.getStatus());
        }
        if (p.getExpiresAt().isBefore(LocalDateTime.now())) {
            // 상태는 매시 만료 작업이 EXPIRED 로 바꾼다 (여기서 저장해도 예외로 롤백됨)
            throw new IllegalStateException("만료된 제안입니다. 에이전트를 다시 실행하세요.");
        }
        p.setDecidedBy(userId);
        p.setDecidedAt(LocalDateTime.now());
        return p;
    }

    /** 매시 정각: 기한이 지난 미결 제안을 EXPIRED 로. 테이블이 아직 없으면(마이그레이션 전) 경고만 남긴다. */
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void expirePending() {
        try {
            int n = proposalRepository.expirePending(LocalDateTime.now());
            if (n > 0) log.info("만료된 에이전트 제안 {}건", n);
        } catch (RuntimeException e) {
            log.warn("에이전트 제안 만료 처리 실패 (007_agent.sql 적용 여부 확인): {}", e.getMessage());
        }
    }
}
