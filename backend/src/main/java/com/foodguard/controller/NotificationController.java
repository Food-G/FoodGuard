package com.foodguard.controller;

import com.foodguard.entity.Notification;
import com.foodguard.service.NotificationService;
import com.foodguard.security.StoreAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final StoreAccessGuard guard;

    /** audience=HQ 면 본사 관리자 전원에게 보낸다 (에이전트·본사만). 기본은 매장 점주. */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        guard.assertCanAccessStoreOrAgent(storeId);
        boolean toHq = "HQ".equals(body.get("audience"));
        if (toHq && !guard.currentUser().isAgent() && !guard.currentUser().isHqAdmin()) {
            throw new AccessDeniedException("본사 알림은 본사·에이전트만 보낼 수 있습니다.");
        }
        // 에이전트는 같은 매장·타입·내용 알림을 24시간 안에 다시 만들지 않는다 (스케줄 반복 실행 대비)
        if (guard.currentUser().isAgent() && notificationService.existsRecent(
                storeId, body.get("type").toString(), body.get("message").toString(), 24)) {
            return ResponseEntity.ok(Map.of("deduplicated", true));
        }
        if (toHq) {
            return ResponseEntity.ok(Map.of("created", notificationService.createForHq(
                    storeId, body.get("message").toString(), body.get("type").toString())));
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

    /** 본사 관리자 본인 앞으로 온 알림. */
    @PreAuthorize("hasRole('HQ_ADMIN')")
    @GetMapping("/hq/unread")
    public ResponseEntity<List<Notification>> getHqUnread() {
        return ResponseEntity.ok(notificationService.getUnreadForUser(guard.currentUser().id()));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<String> markAsRead(@PathVariable Long id) {
        guard.assertCanAccessNotification(id);
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }
}
