package com.foodguard.controller;

import com.foodguard.entity.Attendance;
import com.foodguard.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    // 출퇴근 화면: body {storeId, pin} → 출근 또는 퇴근
    @PostMapping("/clock")
    public ResponseEntity<Map<String, Object>> clock(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(attendanceService.clock(
                Long.parseLong(body.get("storeId").toString()),
                body.get("pin") == null ? null : body.get("pin").toString()));
    }

    // start·end: yyyy-MM-dd (출근 날짜 기준, 포함)
    @GetMapping("/{storeId}")
    public ResponseEntity<List<Attendance>> getByStore(@PathVariable Long storeId,
                                                       @RequestParam String start, @RequestParam String end) {
        return ResponseEntity.ok(attendanceService.getByStore(storeId, LocalDate.parse(start), LocalDate.parse(end)));
    }

    // weekStart: 그 주 월요일 (yyyy-MM-dd)
    @GetMapping("/{storeId}/weekly-pay")
    public ResponseEntity<List<Map<String, Object>>> weeklyPay(@PathVariable Long storeId, @RequestParam String weekStart) {
        return ResponseEntity.ok(attendanceService.weeklyPay(storeId, LocalDate.parse(weekStart)));
    }

    // 점주 수정: body {clockIn, clockOut}
    @PutMapping("/{id}")
    public ResponseEntity<Attendance> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(attendanceService.update(id, body));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        attendanceService.delete(id);
        return ResponseEntity.ok().build();
    }
}
