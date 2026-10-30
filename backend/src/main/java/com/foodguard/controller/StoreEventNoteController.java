package com.foodguard.controller;

import com.foodguard.entity.StoreEventNote;
import com.foodguard.service.StoreEventNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/event-notes")
@RequiredArgsConstructor
public class StoreEventNoteController {

    private final StoreEventNoteService storeEventNoteService;

    // body: {storeId, eventDate: "yyyy-MM-dd", note}. claude 분석 때문에 몇 초 걸린다
    @PostMapping
    public ResponseEntity<StoreEventNote> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(storeEventNoteService.create(body));
    }

    @GetMapping("/{storeId}")
    public ResponseEntity<List<StoreEventNote>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(storeEventNoteService.getByStore(storeId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        storeEventNoteService.delete(id);
        return ResponseEntity.ok().build();
    }
}
