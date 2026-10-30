package com.foodguard.controller;

import com.foodguard.entity.WasteRecord;
import com.foodguard.service.WasteRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/waste-records")
@RequiredArgsConstructor
public class WasteRecordController {

    private final WasteRecordService wasteRecordService;

    @PostMapping
    public ResponseEntity<WasteRecord> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(wasteRecordService.create(body));
    }
}
