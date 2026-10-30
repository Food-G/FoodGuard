package com.foodguard.controller;

import com.foodguard.dto.LocationMessage;
import com.foodguard.entity.OrderRequest;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.service.OrderRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequiredArgsConstructor
public class DeliveryController {

    private final OrderRequestRepository orderRequestRepository;
    private final OrderRequestService orderRequestService;
    private final SimpMessagingTemplate messagingTemplate;

    // 배달 토큰은 승인 시점에 발급되므로 만료 = approved_at + 48h (approved_at 이 없는 과거 행은 만료 없음)
    private static final long TOKEN_TTL_HOURS = 48;
    // 배달 완료로 넘길 수 있는 상태 (REQUESTED·DONE·REJECTED·CANCELLED 에서는 불가)
    private static final Set<String> DELIVERABLE = Set.of("APPROVED", "HQ_SENT", "DRIVER_RECEIVED");

    private static boolean isExpired(OrderRequest order) {
        return order.getApprovedAt() != null
                && order.getApprovedAt().plusHours(TOKEN_TTL_HOURS).isBefore(LocalDateTime.now());
    }

    /** WebSocket 메시지용: 존재하고 만료되지 않은 토큰만 중계한다. */
    private boolean isLiveToken(String token) {
        return orderRequestRepository.findByDeliveryToken(token)
                .filter(o -> !isExpired(o) && DELIVERABLE.contains(o.getStatus()))
                .isPresent();
    }

    // 배달기사용 — 토큰으로 배달 정보 조회 (인증 불필요)
    @GetMapping("/api/delivery/{token}")
    public ResponseEntity<Map<String, Object>> getDeliveryInfo(@PathVariable String token) {
        OrderRequest order = orderRequestRepository.findByDeliveryToken(token).orElse(null);
        if (order == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);

        Map<String, Object> info = new LinkedHashMap<>();
        info.put("orderId", order.getId());
        info.put("storeName", order.getStore().getStoreName());
        info.put("storeAddress", order.getStore().getAddress());
        info.put("ingredientName", order.getIngredient().getName());
        info.put("quantity", order.getOrderedQty());
        info.put("unit", order.getIngredient().getUnit());
        info.put("status", order.getStatus());
        info.put("token", token);
        return ResponseEntity.ok(info);
    }

    // 배달기사용 — 배달 완료 처리
    @PostMapping("/api/delivery/{token}/complete")
    public ResponseEntity<String> completeDelivery(@PathVariable String token) {
        OrderRequest order = orderRequestRepository.findByDeliveryToken(token).orElse(null);
        if (order == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body("배달 정보를 찾을 수 없습니다.");
        if (isExpired(order)) return ResponseEntity.status(HttpStatus.GONE).body("만료된 배달 링크입니다.");
        if (!DELIVERABLE.contains(order.getStatus())) {
            return ResponseEntity.badRequest().body("배달 완료 처리할 수 없는 상태입니다: " + order.getStatus());
        }
        OrderRequest done = orderRequestService.updateStatus(order.getId(), "DONE");
        done.setDeliveryToken(null);  // 1회성: 완료된 링크로 다시 호출할 수 없게 한다
        orderRequestRepository.save(done);
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "DONE", "token", token)
        );
        return ResponseEntity.ok("배달 완료");
    }

    // WebSocket — 배달기사가 배달 시작 → 구독자에게 START 브로드캐스트
    @MessageMapping("/delivery/{token}/start")
    public void startDelivery(@DestinationVariable String token) {
        if (!isLiveToken(token)) return;
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "START", "token", token)
        );
    }

    // WebSocket — 배달기사가 GPS 위치 전송 → 구독자에게 브로드캐스트
    @MessageMapping("/delivery/{token}/location")
    public void receiveLocation(@DestinationVariable String token, LocationMessage location) {
        if (!isLiveToken(token)) return;
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "LOCATION", "lat", location.getLat(), "lng", location.getLng())
        );
    }
}
