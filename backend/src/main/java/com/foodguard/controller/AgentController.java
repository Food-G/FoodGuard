package com.foodguard.controller;

import com.foodguard.service.AgentService;
import com.foodguard.service.IngestService;
import com.foodguard.service.MenuAgentService;
import com.foodguard.service.OrderRequestService;
import com.foodguard.service.SalesCorrectionService;
import com.foodguard.service.WatchdogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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
    private final SalesCorrectionService salesCorrectionService;
    private final MenuAgentService menuAgentService;

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

    @PostMapping("/sales/{storeId}/insight")
    public ResponseEntity<Map<String, Object>> salesInsight(@PathVariable Long storeId,
                                                            @RequestParam String start,
                                                            @RequestParam String end) {
        return ResponseEntity.ok(agentService.salesInsight(storeId, LocalDate.parse(start), LocalDate.parse(end)));
    }

    // 문자 요청 → 변경 미리보기 (저장하지 않음)
    @PostMapping("/sales/{storeId}/corrections/propose")
    public ResponseEntity<Map<String, Object>> proposeCorrection(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(salesCorrectionService.propose(storeId, String.valueOf(body.get("message"))));
    }

    // 점주가 확인한 변경만 반영
    @PostMapping("/sales/{storeId}/corrections/apply")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> applyCorrection(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(salesCorrectionService.apply(storeId, (List<Map<String, Object>>) body.get("changes"), (String) body.get("reason")));
    }

    // 문자 요청 → 메뉴·레시피·식자재 변경 미리보기 (저장하지 않음)
    @PostMapping("/menu-agent/{storeId}/propose")
    public ResponseEntity<Map<String, Object>> proposeMenuChanges(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(menuAgentService.propose(storeId, String.valueOf(body.get("message"))));
    }

    // 점주가 확인한 변경만 반영
    @PostMapping("/menu-agent/{storeId}/apply")
    public ResponseEntity<Map<String, Object>> applyMenuChanges(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> changes) {
        return ResponseEntity.ok(menuAgentService.apply(storeId, changes));
    }

    @PostMapping("/assistant/{storeId}/ask")
    public ResponseEntity<Map<String, Object>> ask(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(agentService.ask(storeId, String.valueOf(body.get("question"))));
    }
}
