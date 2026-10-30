package com.foodguard.service;

import com.foodguard.entity.AgentProposal;
import com.foodguard.entity.OrderRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 승인된 제안을 타입별로 결정적으로 실행한다. 트랜잭션 단위는 제안 1건이다
 * (실패해도 호출 쪽이 FAILED 로 기록할 수 있도록 별도 트랜잭션).
 *
 * 타입은 에이전트를 추가할 때 하나씩 늘린다 (DEV_ROADMAP AG-1~). 재고·발주를 바꾸는 타입은
 * 실행 직전에 fingerprint 를 다시 계산해 다르면 StaleProposalException 을 던진다.
 */
@Service
@RequiredArgsConstructor
public class ProposalExecutor {

    private final OrderRequestService orderRequestService;
    private final RestTemplate restTemplate;

    @Value("${agent.service.url:http://localhost:8100}")
    private String agentServiceUrl;

    /** 제안 이후 재고·발주가 바뀌어 그대로 실행하면 안 되는 경우. 호출 쪽이 STALE 로 기록한다. */
    public static class StaleProposalException extends RuntimeException {
        public StaleProposalException(String message) { super(message); }
    }

    /** 실행 전 확인을 할 수 없는 경우(에이전트 서비스 다운 등). 제안은 PENDING 으로 남아 다시 승인할 수 있다. */
    public static class CheckUnavailableException extends RuntimeException {
        public CheckUnavailableException(String message) { super(message); }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Map<String, Object> execute(AgentProposal p) {
        return switch (p.getType()) {
            // 정보성 제안 (AG-0 더미 에이전트, AG-4 위험 표시): 승인은 "확인했음" 기록일 뿐 실행할 동작이 없다
            case "ORDER_FLAG" -> Map.of("ok", true, "note", "정보성 제안 — 실행할 동작 없음");
            case "ORDER_CREATE" -> createOrders(p);
            default -> throw new IllegalStateException("아직 실행을 지원하지 않는 제안 타입입니다: " + p.getType());
        };
    }

    /** 발주 참모(AG-1) 발주안. 전 항목을 한 트랜잭션으로 생성한다 — 일부만 발주되는 일은 없다. */
    private Map<String, Object> createOrders(AgentProposal p) {
        assertFingerprint(p);
        Object raw = p.getPayload().get("items");
        if (!(raw instanceof List<?> items) || items.isEmpty()) {
            throw new IllegalStateException("발주할 항목이 없습니다.");
        }
        List<Map<String, Object>> created = new ArrayList<>();
        for (Object o : items) {
            Map<?, ?> it = (Map<?, ?>) o;
            long ingredientId = ((Number) it.get("ingredientId")).longValue();
            double qty = ((Number) it.get("orderQty")).doubleValue();
            if (qty <= 0) throw new IllegalStateException("발주량이 0 이하입니다: 식자재 " + ingredientId);
            OrderRequest order = orderRequestService.create(p.getStoreId(), ingredientId, qty);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ingredientId", ingredientId);
            row.put("orderQty", qty);
            row.put("orderId", order.getId());
            created.add(row);
        }
        return Map.of("ok", true, "orders", created);
    }

    /** 제안을 만든 시점의 발주안 ID 와 지금 다시 계산한 ID 를 비교한다 (산식은 agent-service 의 planner 하나뿐). */
    private void assertFingerprint(AgentProposal p) {
        if (p.getFingerprint() == null) throw new StaleProposalException("fingerprint 가 없는 제안입니다.");
        Map<?, ?> now;
        try {
            now = restTemplate.postForObject(agentServiceUrl + "/fingerprint/" + p.getStoreId(), null, Map.class);
        } catch (RestClientException e) {
            throw new CheckUnavailableException("에이전트 서비스에 연결할 수 없어 승인 전 확인을 하지 못했습니다. 잠시 후 다시 승인하세요.");
        }
        Object planId = now != null ? now.get("planId") : null;
        if (!p.getFingerprint().equals(planId)) {
            throw new StaleProposalException("제안 이후 재고·발주·예측이 바뀌었습니다 (#" + p.getFingerprint()
                    + " → #" + planId + "). 다시 계획하세요.");
        }
    }
}
