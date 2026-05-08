package com.foodguard.controller;

import com.foodguard.entity.WasteRecord;
import com.foodguard.service.WasteRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/waste")
@RequiredArgsConstructor
public class WasteRecordController {

    private final WasteRecordService wasteRecordService;

    // 폐기 기록 등록
    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(wasteRecordService.create(
                    Long.parseLong(body.get("storeId").toString()),
                    Long.parseLong(body.get("ingredientId").toString()),
                    Double.parseDouble(body.get("wasteQty").toString()),
                    body.containsKey("wasteDate")
                            ? LocalDate.parse(body.get("wasteDate").toString())
                            : LocalDate.now(),
                    body.containsKey("reason") ? body.get("reason").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 단건 조회
    @GetMapping("/detail/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(wasteRecordService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 가맹점 폐기 기록 전체 조회
    @GetMapping("/{storeId}")
    public ResponseEntity<List<WasteRecord>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(wasteRecordService.getByStore(storeId));
    }

    // 기간별 조회
    @GetMapping("/{storeId}/range")
    public ResponseEntity<List<WasteRecord>> getByDateRange(
            @PathVariable Long storeId,
            @RequestParam String start,
            @RequestParam String end) {
        return ResponseEntity.ok(wasteRecordService.getByDateRange(
                storeId,
                LocalDate.parse(start),
                LocalDate.parse(end)
        ));
    }

    // 식자재별 폐기 기록 조회
    @GetMapping("/{storeId}/ingredient/{ingredientId}")
    public ResponseEntity<List<WasteRecord>> getByIngredient(
            @PathVariable Long storeId,
            @PathVariable Long ingredientId) {
        return ResponseEntity.ok(wasteRecordService.getByIngredient(storeId, ingredientId));
    }

    // 폐기 기록 수정
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id,
                                    @RequestBody Map<String, Object> body) {
        try {
            return ResponseEntity.ok(wasteRecordService.update(
                    id,
                    body.containsKey("wasteQty") ? Double.parseDouble(body.get("wasteQty").toString()) : null,
                    body.containsKey("reason") ? body.get("reason").toString() : null
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 폐기 기록 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", wasteRecordService.delete(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
