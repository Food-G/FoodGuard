package com.foodguard.controller;

import com.foodguard.entity.DonationRecord;
import com.foodguard.service.DonationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/donations")
@RequiredArgsConstructor
public class DonationController {

    private final DonationService donationService;

    @PostMapping("/{storeId}")
    public ResponseEntity<DonationRecord> create(@PathVariable Long storeId,
                                                  @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(donationService.create(storeId, body));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<DonationRecord> complete(@PathVariable Long id) {
        return ResponseEntity.ok(donationService.complete(id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<DonationRecord> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(donationService.cancel(id));
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<DonationRecord>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(donationService.getByStore(storeId));
    }
}
