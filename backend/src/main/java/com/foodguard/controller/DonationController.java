package com.foodguard.controller;

import com.foodguard.entity.DonationRecord;
import com.foodguard.service.DonationService;
import com.foodguard.service.StoreAccessService;
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
    private final StoreAccessService storeAccessService;

    @PostMapping("/{storeId}")
    public ResponseEntity<DonationRecord> create(@PathVariable Long storeId,
                                                  @RequestBody Map<String, Object> body) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(donationService.create(storeId, body));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<DonationRecord> complete(@PathVariable Long id) {
        storeAccessService.checkStore(donationService.getById(id).getStoreId());
        return ResponseEntity.ok(donationService.complete(id));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<DonationRecord> cancel(@PathVariable Long id) {
        storeAccessService.checkStore(donationService.getById(id).getStoreId());
        return ResponseEntity.ok(donationService.cancel(id));
    }

    @GetMapping("/store/{storeId}")
    public ResponseEntity<List<DonationRecord>> getByStore(@PathVariable Long storeId) {
        storeAccessService.checkStore(storeId);
        return ResponseEntity.ok(donationService.getByStore(storeId));
    }
}
