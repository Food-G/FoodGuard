package com.foodguard.security;

/**
 * JWT에서 뽑아낸 현재 로그인 사용자.
 * JwtFilter가 Authentication의 principal로 넣어두고, StoreAccessGuard가 읽는다.
 */
public record AuthUser(Long id, String email, String role) {

    public boolean isHqAdmin() {
        return "HQ_ADMIN".equals(role);
    }

    /** 에이전트 서비스 계정. 조회(GET)는 전 매장, 쓰기는 제안·실행기록만 (SecurityConfig). */
    public boolean isAgent() {
        return "AGENT".equals(role);
    }
}
