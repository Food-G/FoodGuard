package com.foodguard.controller;

import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.StaffService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 매장 직원 (직원 관리 화면). 점주는 자기 매장만, 본사는 전체. */
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;
    private final StoreAccessGuard guard;

    private static final ResponseEntity<?> NOT_READY = ResponseEntity.status(503).body(Map.of("message",
            "직원 관리가 아직 적용되지 않았습니다 (009_staff.sql 적용 후 서버 재시작)."));

    @GetMapping("/store/{storeId}")
    public ResponseEntity<?> getByStore(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        if (!staffService.isEnabled()) return NOT_READY;
        return ResponseEntity.ok(staffService.getByStore(storeId));
    }

    @PostMapping("/{storeId}")
    public ResponseEntity<?> create(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        guard.assertCanAccessStore(storeId);
        if (!staffService.isEnabled()) return NOT_READY;
        return ResponseEntity.ok(staffService.create(storeId, str(body, "name"), str(body, "role"),
                StaffService.parseDays(body.get("workDays")), str(body, "startTime"), str(body, "endTime")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        if (!staffService.isEnabled()) return NOT_READY;
        guard.assertCanAccessStaff(id);
        return ResponseEntity.ok(staffService.update(id, str(body, "name"), str(body, "role"),
                StaffService.parseDays(body.get("workDays")), str(body, "startTime"), str(body, "endTime")));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!staffService.isEnabled()) return NOT_READY;
        guard.assertCanAccessStaff(id);
        staffService.delete(id);
        return ResponseEntity.ok(Map.of("deleted", id));
    }

    private static String str(Map<String, Object> body, String key) {
        Object v = body.get(key);
        return v == null ? null : v.toString();
    }
}
