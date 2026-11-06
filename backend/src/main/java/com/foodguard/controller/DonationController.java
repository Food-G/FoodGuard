package com.foodguard.controller;

import com.foodguard.entity.DonationRecord;
import com.foodguard.security.StoreAccessGuard;
import com.foodguard.service.DonationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DonationController {

    private final DonationService donationService;
    private final StoreAccessGuard guard;

    @PostMapping("/donations/{storeId}")
    public ResponseEntity<DonationRecord> create(@PathVariable Long storeId, @RequestBody Map<String, Object> body) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(donationService.create(
                storeId,
                Long.parseLong(body.get("ingredientId").toString()),
                Double.parseDouble(body.get("quantity").toString()),
                String.valueOf(body.get("donationType")),
                body.get("orgName") != null ? body.get("orgName").toString() : null,
                String.valueOf(body.get("orgType")),
                body.get("orgContact") != null ? body.get("orgContact").toString() : null,
                body.get("description") != null ? body.get("description").toString() : null
        ));
    }

    @PostMapping("/donations/{id}/complete")
    public ResponseEntity<DonationRecord> complete(@PathVariable Long id) {
        guard.assertCanAccessDonation(id);
        return ResponseEntity.ok(donationService.complete(id));
    }

    @PostMapping("/donations/{id}/cancel")
    public ResponseEntity<DonationRecord> cancel(@PathVariable Long id) {
        guard.assertCanAccessDonation(id);
        return ResponseEntity.ok(donationService.cancel(id));
    }

    @GetMapping("/donations/store/{storeId}")
    public ResponseEntity<List<DonationRecord>> getByStore(@PathVariable Long storeId) {
        guard.assertCanAccessStore(storeId);
        return ResponseEntity.ok(donationService.getByStore(storeId));
    }

    /** 매장 지역에서 그 카테고리를 받는 기부처. category 를 빼면 지역만 본다. */
    @GetMapping("/donation-orgs")
    public ResponseEntity<?> orgs(@RequestParam Long storeId, @RequestParam(required = false) String category) {
        guard.assertCanAccessStore(storeId);
        if (!donationService.isOrgsEnabled()) {
            return ResponseEntity.status(503).body(Map.of("message",
                    "기부처 목록이 아직 적용되지 않았습니다 (008_donation_org.sql 적용 후 서버 재시작)."));
        }
        return ResponseEntity.ok(donationService.orgsFor(storeId, category));
    }
}
