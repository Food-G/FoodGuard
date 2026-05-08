package com.foodguard.controller;

import com.foodguard.entity.Notification;
import com.foodguard.service.NotificationService;
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

    // 알림 생성
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            Long storeId = Long.parseLong(body.get("storeId").toString());
            String message = body.get("message").toString();
            String type = body.get("type").toString();

            if (body.containsKey("userId")) {
                Long userId = Long.parseLong(body.get("userId").toString());
                return ResponseEntity.ok(notificationService.create(storeId, userId, message, type));
            }
            return ResponseEntity.ok(notificationService.create(storeId, message, type));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 전체 알림 조회 (매장 기준)
    @GetMapping("/{storeId}")
    public ResponseEntity<List<Notification>> getAll(@PathVariable Long storeId) {
        return ResponseEntity.ok(notificationService.getAll(storeId));
    }

    // 읽지 않은 알림 조회
    @GetMapping("/{storeId}/unread")
    public ResponseEntity<List<Notification>> getUnread(@PathVariable Long storeId) {
        return ResponseEntity.ok(notificationService.getUnread(storeId));
    }

    // 유저 기준 전체 알림
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Notification>> getAllByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getAllByUser(userId));
    }

    // 유저 기준 읽지 않은 알림
    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<Notification>> getUnreadByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.getUnreadByUser(userId));
    }

    // 알림 읽음 처리
    @PutMapping("/{id}/read")
    public ResponseEntity<?> markAsRead(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", notificationService.markAsRead(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 매장 전체 읽음 처리
    @PutMapping("/{storeId}/read-all")
    public ResponseEntity<?> markAllAsRead(@PathVariable Long storeId) {
        try {
            return ResponseEntity.ok(Map.of("message", notificationService.markAllAsRead(storeId)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 알림 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", notificationService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
