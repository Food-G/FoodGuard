package com.foodguard.security;

/**
 * JWT에서 뽑아낸 현재 로그인 사용자.
 * JwtFilter가 Authentication의 principal로 넣어두고, StoreAccessGuard가 읽는다.
 */
public record AuthUser(Long id, String email, String role) {

    public boolean isHqAdmin() {
        return "HQ_ADMIN".equals(role);
    }
}
