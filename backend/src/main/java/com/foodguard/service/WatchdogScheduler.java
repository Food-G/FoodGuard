package com.foodguard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// 매일 아침 전 매장 점검 → 알림. 개발 PC 가 공유 DB 에 알림을 쌓지 않게 운영 프로필에서만 켠다
@Component
@EnableScheduling
@ConditionalOnProperty(name = "app.watchdog.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class WatchdogScheduler {

    private final WatchdogService watchdogService;

    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Seoul")
    public void run() {
        log.info("재고·데이터 점검: 알림 {}건 생성", watchdogService.notifyAllStores());
    }
}
