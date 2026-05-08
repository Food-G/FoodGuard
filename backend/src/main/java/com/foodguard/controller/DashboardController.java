package com.foodguard.controller;

import com.foodguard.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    // 점주 대시보드
    @GetMapping("/store/{storeId}")
    public ResponseEntity<?> getStoreDashboard(@PathVariable Long storeId) {
        try {
            return ResponseEntity.ok(dashboardService.getStoreDashboard(storeId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 본사 통합 대시보드
    @GetMapping("/hq")
    public ResponseEntity<?> getHQDashboard() {
        try {
            return ResponseEntity.ok(dashboardService.getHQDashboard());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
