package com.foodguard.controller;

import com.foodguard.entity.Notification;
import com.foodguard.service.NotificationService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final StoreAccessGuard guard;

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        guard.assertCanAccessStoreOrAgent(storeId);
        // 에이전트는 같은 매장·타입·내용 알림을 24시간 안에 다시 만들지 않는다 (스케줄 반복 실행 대비)
        if (guard.currentUser().isAgent() && notificationService.existsRecent(
                storeId, body.get("type").toString(), body.get("message").toString(), 24)) {
            return ResponseEntity.ok(Map.of("deduplicated", true));
        }
        return ResponseEntity.ok(notificationService.create(
                storeId,
                body.get("message").toString(),
                body.get("type").toString()
        ));
    }

    @GetMapping("/{storeId}/unread")
    public ResponseEntity<List<Notification>> getUnread(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(notificationService.getUnread(storeId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<String> markAsRead(@PathVariable Long id) {
        guard.assertCanAccessNotification(id);
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }
}