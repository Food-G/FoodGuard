package com.foodguard.controller;

import com.foodguard.dto.SaleResponse;
import com.foodguard.service.SalesDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
public class SalesDataController {

    private final SalesDataService salesDataService;

    @PostMapping
    public ResponseEntity<SaleResponse> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(new SaleResponse(salesDataService.create(
                Long.parseLong(body.get("storeId").toString()),
                Long.parseLong(body.get("menuId").toString()),
                Integer.parseInt(body.get("quantity").toString()),
                LocalDate.parse(body.get("saleDate").toString())
        )));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<SaleResponse>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDataService.getByStore(storeId)
                .stream().map(SaleResponse::new).collect(Collectors.toList()));
    }

    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<SaleResponse>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        return ResponseEntity.ok(salesDataService.getByDateRange(
                storeId, LocalDate.parse(start), LocalDate.parse(end))
                .stream().map(SaleResponse::new).collect(Collectors.toList()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> delete(@PathVariable Long id) {
        return ResponseEntity.ok(salesDataService.delete(id));
    }
}
