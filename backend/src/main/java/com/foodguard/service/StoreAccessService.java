package com.foodguard.service;

import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

// 요청한 사용자의 매장 접근 권한 확인 — HQ_ADMIN은 전부 통과, OWNER는 자기 매장(Store.user)만. 실패 시 403
@Service
@RequiredArgsConstructor
public class StoreAccessService {

    private final StoreRepository storeRepository;

    // 본사 관리자 여부
    public boolean isHqAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_HQ_ADMIN".equals(a.getAuthority()));
    }

    // 본사 관리자만 허용
    public void checkHqAdmin() {
        if (!isHqAdmin()) {
            throw new AccessDeniedException("본사 관리자만 사용할 수 있습니다.");
        }
    }

    // 매장 주인 또는 본사 관리자만 허용
    public void checkStore(Long storeId) {
        if (isHqAdmin()) return;
        Long userId = currentUserId();
        if (userId == null || storeId == null || !storeRepository.existsByIdAndUserId(storeId, userId)) {
            throw new AccessDeniedException("해당 매장에 대한 권한이 없습니다.");
        }
    }

    // 본인 또는 본사 관리자만 허용
    public void checkUser(Long userId) {
        if (isHqAdmin()) return;
        Long current = currentUserId();
        if (current == null || !current.equals(userId)) {
            throw new AccessDeniedException("본인 계정에 대해서만 사용할 수 있습니다.");
        }
    }

    // JwtFilter가 details에 넣은 사용자 id
    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getDetails() instanceof Long id ? id : null;
    }
}
