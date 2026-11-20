package com.foodguard.security;

import java.security.Principal;

/**
 * JWT 에서 꺼낸 로그인 사용자. JwtFilter 가 Authentication 의 principal 과 details 에 같이 넣는다.
 * StoreAccess 는 details, StoreAccessGuard·InventoryLedger 는 principal 을 읽는다.
 * Principal 이라 Authentication.getName() 은 기존처럼 이메일을 돌려준다.
 */
public record AuthUser(Long id, String email, String role) implements Principal {

    @Override
    public String getName() {
        return email;
    }

    public boolean isHqAdmin() {
        return "HQ_ADMIN".equals(role);
    }

    /** 에이전트 서비스 계정. 조회(GET)는 전 매장, 쓰기는 제안·실행기록만 (SecurityConfig). */
    public boolean isAgent() {
        return "AGENT".equals(role);
    }
}
