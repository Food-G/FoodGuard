package com.foodguard.controller;

import com.foodguard.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    // 본사 통계 페이지: 월별 매출·폐기, 가맹점별 폐기율, 추천 적용률
    @GetMapping("/hq")
    public ResponseEntity<Map<String, Object>> hq() {
        return ResponseEntity.ok(statsService.hq());
    }
}
