package com.foodguard.controller;

import com.foodguard.entity.PosTable;
import com.foodguard.service.PosTableService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pos-tables")
@RequiredArgsConstructor
public class PosTableController {

    private final PosTableService posTableService;

    @GetMapping("/{storeId}")
    public ResponseEntity<List<PosTable>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(posTableService.getByStore(storeId));
    }

    // 배치 전체 저장: body [{name, x, y, w, h, seats}, ...]
    @PutMapping("/{storeId}")
    public ResponseEntity<List<PosTable>> replace(@PathVariable Long storeId, @RequestBody List<Map<String, Object>> body) {
        return ResponseEntity.ok(posTableService.replace(storeId, body));
    }
}
