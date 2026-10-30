package com.foodguard.controller;

import com.foodguard.entity.SalesDayFlag;
import com.foodguard.service.SalesDayFlagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales-flags")
@RequiredArgsConstructor
public class SalesDayFlagController {

    private final SalesDayFlagService salesDayFlagService;

    // body: {storeId, flagDate: "yyyy-MM-dd", flagType: "CLOSED"|"SOLD_OUT", menuId(품절일 때)}
    @PostMapping
    public ResponseEntity<SalesDayFlag> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(salesDayFlagService.create(body));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<SalesDayFlag>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(salesDayFlagService.getByStore(storeId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        salesDayFlagService.delete(id);
        return ResponseEntity.ok().build();
    }
}
