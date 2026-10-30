package com.foodguard.security;

// JWT 에서 꺼낸 로그인 사용자 (Authentication.details). principal 은 기존처럼 이메일 문자열
public record AuthUser(Long id, String role) {

    public boolean isHqAdmin() {
        return "HQ_ADMIN".equals(role);
    }
}
