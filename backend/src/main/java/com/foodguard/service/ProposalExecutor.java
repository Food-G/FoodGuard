package com.foodguard.service;

import com.foodguard.entity.AgentProposal;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.InventoryLotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
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
    private final NotificationService notificationService;
    private final WasteService wasteService;
    private final InventoryLotRepository lotRepository;
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
            case "DISCOUNT_SUGGEST" -> notifyDiscount(p);
            case "WASTE_RECORD" -> recordWaste(p);
            // 폐기 위험 감축 힌트 (AG-2): 승인(EXECUTED)된 제안을 발주 참모가 조회해 다음 발주안에 반영한다
            case "ORDER_REDUCE" -> Map.of("ok", true, "note", "다음 발주안에 감축이 반영됩니다.");
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

    /** 폐기 위험(AG-2) 판촉 제안: 가격·메뉴를 바꾸지 않고 점주가 할 일을 알림으로 남긴다. */
    private Map<String, Object> notifyDiscount(AgentProposal p) {
        Object raw = p.getPayload().get("items");
        if (!(raw instanceof List<?> items) || items.isEmpty()) {
            throw new IllegalStateException("판촉 대상 품목이 없습니다.");
        }
        List<String> lines = new ArrayList<>();
        for (Object o : items) {
            Map<?, ?> it = (Map<?, ?>) o;
            lines.add(it.get("ingredientName") + "(" + it.get("menus") + ")");
        }
        notificationService.create(p.getStoreId(), "[폐기 위험] 판촉 체크리스트: " + String.join(", ", lines), "WASTE");
        return Map.of("ok", true, "notified", lines.size());
    }

    /**
     * 폐기 위험(AG-2) 만료분 폐기 등록. 전 항목을 한 트랜잭션으로 처리한다.
     * 제안 이후 판매 차감이나 먼저 승인한 같은 제안으로 만료 재고가 줄었으면 STALE — 안 만료된 재고를 버리지 않게 한다.
     */
    private Map<String, Object> recordWaste(AgentProposal p) {
        Object raw = p.getPayload().get("items");
        if (!(raw instanceof List<?> items) || items.isEmpty()) {
            throw new IllegalStateException("폐기할 항목이 없습니다.");
        }
        List<Map<String, Object>> recorded = new ArrayList<>();
        for (Object o : items) {
            Map<?, ?> it = (Map<?, ?>) o;
            long ingredientId = ((Number) it.get("ingredientId")).longValue();
            double qty = ((Number) it.get("qty")).doubleValue();
            double expired = lotRepository.findOpenFifo(p.getStoreId(), ingredientId).stream()
                    .filter(l -> l.getExpiryDate() != null && l.getExpiryDate().isBefore(LocalDate.now()))
                    .mapToDouble(l -> l.getRemainingQty().doubleValue()).sum();
            if (qty > expired + 0.005) {
                throw new StaleProposalException("제안 이후 만료 재고가 바뀌었습니다 (식자재 " + ingredientId
                        + ": 제안 " + qty + " → 현재 " + expired + "). 다시 점검하세요.");
            }
            WasteRecord w = wasteService.record(p.getStoreId(), ingredientId, qty, String.valueOf(it.get("reason")));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("ingredientId", ingredientId);
            row.put("qty", qty);
            row.put("wasteId", w.getId());
            recorded.add(row);
        }
        return Map.of("ok", true, "records", recorded);
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
