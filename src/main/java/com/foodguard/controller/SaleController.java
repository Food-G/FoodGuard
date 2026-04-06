package com.foodguard.controller;

import com.foodguard.dto.SaleRequest;
import com.foodguard.dto.SaleResponse;
import com.foodguard.service.SaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SaleController {

    private final SaleService saleService;

    // 매출 저장
    @PostMapping
    public ResponseEntity<SaleResponse> create(@RequestBody SaleRequest request) {
        return ResponseEntity.ok(saleService.create(request));
    }

    // 전체 매출 조회
    @GetMapping
    public ResponseEntity<List<SaleResponse>> getAll() {
        return ResponseEntity.ok(saleService.getAll());
    }

    // 특정 매출 조회
    @GetMapping("/{id}")
    public ResponseEntity<SaleResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getById(id));
    }

    // 매출 수정
    @PutMapping("/{id}")
    public ResponseEntity<SaleResponse> update(@PathVariable Long id,
                                               @RequestBody SaleRequest request) {
        return ResponseEntity.ok(saleService.update(id, request));
    }

    // 매출 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.delete(id));
    }
}