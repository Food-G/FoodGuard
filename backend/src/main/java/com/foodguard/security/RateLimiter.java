package com.foodguard.security;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 키별 고정 창 횟수 제한 (메모리). 서버 1대 기준이라 재시작하면 초기화되고, 여러 대로 늘리면 Redis 등으로 옮겨야 한다.
 */
@Component
public class RateLimiter {

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    // 창 안에 max 번 미만이면 기록하고 true
    public boolean tryAcquire(String key, int max, long windowMillis) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() <= now - windowMillis) q.pollFirst();
            if (q.size() >= max) return false;
            q.addLast(now);
            return true;
        }
    }

    public boolean isBlocked(String key, int max, long windowMillis) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.get(key);
        if (q == null) return false;
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() <= now - windowMillis) q.pollFirst();
            return q.size() >= max;
        }
    }

    public void record(String key) {
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            q.addLast(System.currentTimeMillis());
        }
    }

    public void reset(String key) {
        hits.remove(key);
    }
}
