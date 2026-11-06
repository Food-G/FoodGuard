package com.foodguard.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Claude·모델 학습을 부르는 API 의 사용자별 분당 횟수 제한. 호출마다 비용과 CPU 가 든다.
 */
@Component
@RequiredArgsConstructor
public class AiRateLimitInterceptor implements HandlerInterceptor {

    // Claude 를 부르는 POST 경로. GET 은 조회라 제한하지 않는다
    static final String[] PATHS = {
            "/api/assistant/**", "/api/ingest/*/sales/preview", "/api/ingest/*/invoice/preview",
            "/api/ingredients/suggest/**", "/api/orders/recommend/*/review", "/api/orders/recommend/*/explain",
            "/api/discounts/store/*/briefing", "/api/stats/hq/weekly-report", "/api/event-notes", "/api/predictions/*/trigger",
    };

    private final RateLimiter rateLimiter;
    private final StoreAccess storeAccess;

    @Value("${app.ai.max-calls-per-minute:20}")
    private int maxPerMinute;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"POST".equals(request.getMethod())) return true;
        AuthUser user = storeAccess.currentUser();
        String key = "ai:" + (user != null ? user.id() : request.getRemoteAddr());
        if (!rateLimiter.tryAcquire(key, maxPerMinute, 60_000)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "AI 요청이 너무 많습니다. 1분 뒤 다시 시도해 주세요.");
        }
        return true;
    }
}
