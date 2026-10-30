package com.foodguard.service;

import com.foodguard.entity.AgentProposal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * 승인된 제안을 타입별로 결정적으로 실행한다. 트랜잭션 단위는 제안 1건이다
 * (실패해도 호출 쪽이 FAILED 로 기록할 수 있도록 별도 트랜잭션).
 *
 * 타입은 에이전트를 추가할 때 하나씩 늘린다 (DEV_ROADMAP AG-1~). 재고·발주를 바꾸는 타입은
 * 실행 직전에 fingerprint 를 다시 계산해 다르면 StaleProposalException 을 던진다.
 */
@Service
public class ProposalExecutor {

    /** 제안 이후 재고·발주가 바뀌어 그대로 실행하면 안 되는 경우. 호출 쪽이 STALE 로 기록한다. */
    public static class StaleProposalException extends RuntimeException {
        public StaleProposalException(String message) { super(message); }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> execute(AgentProposal p) {
        return switch (p.getType()) {
            // 정보성 제안 (AG-0 더미 에이전트, AG-4 위험 표시): 승인은 "확인했음" 기록일 뿐 실행할 동작이 없다
            case "ORDER_FLAG" -> Map.of("ok", true, "note", "정보성 제안 — 실행할 동작 없음");
            default -> throw new IllegalStateException("아직 실행을 지원하지 않는 제안 타입입니다: " + p.getType());
        };
    }
}
