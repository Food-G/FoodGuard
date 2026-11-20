package com.foodguard.controller;

import com.foodguard.entity.Reservation;
import com.foodguard.service.ReservationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reservations")
@RequiredArgsConstructor
public class ReservationController {

    private final ReservationService reservationService;

    // from(yyyy-MM-dd) 이후 예약. 비우면 최근 30일부터
    @GetMapping("/{storeId}")
    public ResponseEntity<List<Reservation>> getByStore(@PathVariable Long storeId, @RequestParam(required = false) String from) {
        LocalDate start = from == null ? LocalDate.now().minusDays(30) : LocalDate.parse(from);
        return ResponseEntity.ok(reservationService.getByStore(storeId, start));
    }

    // body: {storeId, customerName, phone, reservationDate, reservationTime, guests, note}
    @PostMapping
    public ResponseEntity<Reservation> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(reservationService.create(body));
    }

    // body: {status: RESERVED | VISITED | CANCELLED}
    @PutMapping("/{id}/status")
    public ResponseEntity<Reservation> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(reservationService.updateStatus(id, body.get("status")));
    }
}
