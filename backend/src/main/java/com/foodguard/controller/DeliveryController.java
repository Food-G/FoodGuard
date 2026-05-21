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

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class DeliveryController {

    private final OrderRequestRepository orderRequestRepository;
    private final OrderRequestService orderRequestService;
    private final SimpMessagingTemplate messagingTemplate;

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
        orderRequestService.updateStatus(order.getId(), "DONE");
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "DONE", "token", token)
        );
        return ResponseEntity.ok("배달 완료");
    }

    // WebSocket — 배달기사가 배달 시작 → 구독자에게 START 브로드캐스트
    @MessageMapping("/delivery/{token}/start")
    public void startDelivery(@DestinationVariable String token) {
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "START", "token", token)
        );
    }

    // WebSocket — 배달기사가 GPS 위치 전송 → 구독자에게 브로드캐스트
    @MessageMapping("/delivery/{token}/location")
    public void receiveLocation(@DestinationVariable String token, LocationMessage location) {
        messagingTemplate.convertAndSend(
                "/topic/delivery/" + token,
                Map.of("type", "LOCATION", "lat", location.getLat(), "lng", location.getLng())
        );
    }
}
