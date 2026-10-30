package com.foodguard.controller;

import com.foodguard.entity.SalesTarget;
import com.foodguard.service.SalesPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/sales-plan")
@RequiredArgsConstructor
public class SalesPlanController {

    private final SalesPlanService salesPlanService;

    // week: 그 주의 아무 날짜 (기본 오늘)
    @GetMapping("/{storeId}")
    public ResponseEntity<Map<String, Object>> getPlan(@PathVariable Long storeId,
                                                       @RequestParam(required = false) String week) {
        LocalDate day = week != null ? LocalDate.parse(week) : LocalDate.now();
        return ResponseEntity.ok(salesPlanService.getPlan(storeId, day, LocalDate.now()));
    }

    // body: {weekStart: "yyyy-MM-dd", targetAmount: 원}
    @PutMapping("/{storeId}/target")
    public ResponseEntity<SalesTarget> saveTarget(@PathVariable Long storeId,
                                                  @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(salesPlanService.saveTarget(
                storeId,
                LocalDate.parse(body.get("weekStart").toString()),
                Long.parseLong(body.get("targetAmount").toString())));
    }
}
