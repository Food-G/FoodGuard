package com.foodguard.controller;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.OrderRequest;
import com.foodguard.service.OrderRequestService;
import com.foodguard.service.StoreAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderRequestController {

    private final OrderRequestService orderRequestService;
    private final StoreAccessService storeAccessService;

    @PostMapping
    public ResponseEntity<OrderRequest> create(@RequestBody Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(orderRequestService.create(
                storeId,
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString())
        ));
    }

    @GetMapping("/admin/all")
    public ResponseEntity<List<OrderRequest>> getAll() {
        return ResponseEntity.ok(orderRequestService.getAll());
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<OrderRequest>> getByStore(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(orderRequestService.getByStore(storeId));
    }

    // 1단계: 본사 발송 검수 완료 (body: {expiryDate: "yyyy-MM-dd"})
    @PostMapping("/{id}/hq-send")
    public ResponseEntity<Map<String, Object>> hqSend(@PathVariable Long id,
                                                       @RequestBody(required = false) Map<String, Object> body) {
        String expiryDateStr = body != null ? (String) body.get("expiryDate") : null;
        LocalDate expiryDate = (expiryDateStr != null && !expiryDateStr.isBlank())
                ? LocalDate.parse(expiryDateStr) : null;
        return ResponseEntity.ok(orderRequestService.hqSend(id, expiryDate));
    }

    // QR 스캔 검수 처리 — 앱 내 스캔 (Base64 JSON)
    @PostMapping("/scan")
    public ResponseEntity<Map<String, Object>> scan(@RequestBody Map<String, Object> body) {
        String qrData = (String) body.get("qrData");
        return ResponseEntity.ok(orderRequestService.processQrScan(qrData));
    }

    // QR 스캔 검수 처리 — 네이티브 카메라 URL 방식
    @GetMapping("/scan")
    public ResponseEntity<Map<String, Object>> scanByToken(@RequestParam String token) {
        return ResponseEntity.ok(orderRequestService.processQrScanByToken(token));
    }

    // 배달기사 전용 QR 스캔 — HQ_SENT→DRIVER_RECEIVED만 처리 (중복 스캔 안전)
    @GetMapping("/driver-scan")
    public ResponseEntity<Map<String, Object>> driverScan(@RequestParam String token) {
        return ResponseEntity.ok(orderRequestService.driverQrScan(token));
    }

    // 가맹점주 전용 QR 스캔 — DRIVER_RECEIVED→DONE+재고
    @GetMapping("/owner-scan")
    public ResponseEntity<?> ownerScan(@RequestParam String token) {
        storeAccessService.checkStore(orderRequestService.getByQrToken(token).getStore().getId());
        try {
            return ResponseEntity.ok(orderRequestService.ownerQrScan(token));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 2단계: 배달기사 수령 확인
    @PostMapping("/{id}/driver-receive")
    public ResponseEntity<OrderRequest> driverReceive(@PathVariable Long id) {
        return ResponseEntity.ok(orderRequestService.driverReceive(id));
    }

    // 3단계: 가맹점주 수령 확인
    @PostMapping("/{id}/owner-receive")
    public ResponseEntity<OrderRequest> ownerReceive(@PathVariable Long id) {
        checkOrderStore(id);
        return ResponseEntity.ok(orderRequestService.ownerReceive(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<OrderRequest> updateStatus(@PathVariable Long id,
                                                     @RequestBody Map<String, Object> body) {
        String status = body.get("status").toString();
        // 승인·반려는 본사만, 그 외 상태 변경은 해당 매장 점주 또는 본사
        if ("APPROVED".equals(status) || "REJECTED".equals(status)) {
            storeAccessService.checkHqAdmin();
        } else {
            checkOrderStore(id);
        }
        return ResponseEntity.ok(orderRequestService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> cancel(@PathVariable Long id) {
        checkOrderStore(id);
        return ResponseEntity.ok(orderRequestService.cancel(id));
    }

    @GetMapping("/recommend/{storeId}")
    public ResponseEntity<List<Map<String, Object>>> recommend(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(orderRequestService.recommend(storeId));
    }

    @PostMapping("/auto/{storeId}")
    public ResponseEntity<List<Long>> autoOrder(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(orderRequestService.autoOrder(storeId));
    }

    private void checkOrderStore(Long orderId) {
        storeAccessService.checkStore(orderRequestService.getById(orderId).getStore().getId());
    }
}