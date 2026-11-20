package com.foodguard.controller;

import com.foodguard.service.AgentService;
import com.foodguard.service.IngestService;
import com.foodguard.service.OrderRequestService;
import com.foodguard.service.WatchdogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// 에이전트 기능. {storeId} 소유 검사는 StoreAccessInterceptor, /api/stats/** 본사 제한은 SecurityConfig 가 한다
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AgentController {

    private final IngestService ingestService;
    private final AgentService agentService;
    private final OrderRequestService orderRequestService;
    private final WatchdogService watchdogService;

    @PostMapping("/ingest/{storeId}/sales/preview")
    public ResponseEntity<Map<String, Object>> previewSales(@PathVariable Long storeId, @RequestBody Map<String, Object> file) {
        return ResponseEntity.ok(ingestService.previewSales(storeId, file));
    }

    @PostMapping("/ingest/{storeId}/sales/commit")
    public ResponseEntity<Map<String, Object>> commitSales(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> rows) {
        return ResponseEntity.ok(ingestService.commitSales(storeId, rows));
    }

    @PostMapping("/ingest/{storeId}/invoice/preview")
    public ResponseEntity<Map<String, Object>> previewInvoice(@PathVariable Long storeId, @RequestBody Map<String, Object> file) {
        return ResponseEntity.ok(ingestService.previewInvoice(storeId, file));
    }

    @PostMapping("/ingest/{storeId}/invoice/commit")
    public ResponseEntity<Map<String, Object>> commitInvoice(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> items) {
        return ResponseEntity.ok(ingestService.commitInvoice(storeId, items));
    }

    @PostMapping("/ingredients/suggest/{storeId}")
    public ResponseEntity<Map<String, Object>> suggestIngredientSettings(@PathVariable Long storeId) {
        return ResponseEntity.ok(agentService.suggestIngredientSettings(storeId));
    }

    @PostMapping("/orders/recommend/{storeId}/review")
    public ResponseEntity<Map<String, Object>> reviewOrder(@PathVariable Long storeId) {
        return ResponseEntity.ok(agentService.reviewOrder(storeId));
    }

    // 발주 참모 화면에서 점주가 승인한 항목만 발주한다
    @PostMapping("/orders/agent/{storeId}")
    public ResponseEntity<List<Long>> agentOrder(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> items) {
        return ResponseEntity.ok(orderRequestService.agentOrder(storeId, items));
    }

    @GetMapping("/watchdog/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> watchdog(@PathVariable Long storeId) {
        return ResponseEntity.ok(watchdogService.findings(storeId));
    }

    @PostMapping("/stats/hq/weekly-report")
    public ResponseEntity<Map<String, Object>> hqWeeklyReport() {
        return ResponseEntity.ok(agentService.hqWeeklyReport());
    }

    @PostMapping("/assistant/{storeId}/ask")
    public ResponseEntity<Map<String, Object>> ask(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(agentService.ask(storeId, String.valueOf(body.get("question"))));
    }
}
