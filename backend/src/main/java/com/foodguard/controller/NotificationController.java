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

    @PostMapping
    public ResponseEntity<Notification> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(notificationService.create(
                Long.parseLong(body.get("storeId").toString()),
                body.get("message").toString(),
                body.get("type").toString()
        ));
    }

    @GetMapping("/{storeId}/unread")
    public ResponseEntity<List<Notification>> getUnread(@PathVariable Long storeId) {
        return ResponseEntity.ok(notificationService.getUnread(storeId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<String> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }
}