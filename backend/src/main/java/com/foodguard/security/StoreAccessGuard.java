package com.foodguard.security;

import com.foodguard.entity.Store;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.NotificationRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Objects;

/**
 * 매장 소유권 검사.
 *
 * 역할 검사(@PreAuthorize)는 "본사 전용 API인가"만 막아준다. 그것만으로는
 * OWNER 토큰으로 storeId 만 바꿔 남의 매장 데이터를 읽는 것을 막지 못한다.
 * 프론트엔드 라우팅이 사실상 가려주고 있었지만 AI 에이전트는 프론트를 거치지 않으므로
 * 서버에서 직접 막는다.
 *
 * HQ_ADMIN 은 전 매장을 볼 수 있으므로 모든 검사를 통과한다.
 */
@Component
@RequiredArgsConstructor
public class StoreAccessGuard {

    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final SalesDataRepository salesDataRepository;
    private final NotificationRepository notificationRepository;

    // ── 현재 사용자 ────────────────────────────────────────────────────

    public AuthUser currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof AuthUser user)) {
            throw new AccessDeniedException("인증 정보가 없습니다.");
        }
        return user;
    }

    // ── 매장 기준 검사 ─────────────────────────────────────────────────

    /** 해당 매장의 소유 점주이거나 HQ_ADMIN 이어야 한다. */
    public void assertCanAccessStore(Long storeId) {
        AuthUser user = currentUser();
        if (user.isHqAdmin()) return;

        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new AccessDeniedException("가맹점을 찾을 수 없습니다."));
        Long ownerId = store.getUser() != null ? store.getUser().getId() : null;
        if (!Objects.equals(ownerId, user.id())) {
            throw new AccessDeniedException("본인 매장이 아닙니다.");
        }
    }

    /** 본인 userId 로만 조회 가능 (예: GET /api/stores/my/{userId}). */
    public void assertIsSelf(Long userId) {
        AuthUser user = currentUser();
        if (user.isHqAdmin()) return;
        if (!Objects.equals(userId, user.id())) {
            throw new AccessDeniedException("본인 계정이 아닙니다.");
        }
    }

    // ── 엔티티 id 기준 검사 ────────────────────────────────────────────
    // storeId 가 아닌 엔티티 id 를 받는 엔드포인트(PUT/DELETE)도 막아야
    // id 를 바꿔가며 남의 데이터를 수정하는 경로가 닫힌다.

    public void assertCanAccessMenu(Long menuId) {
        assertCanAccessStore(menuRepository.findById(menuId)
                .orElseThrow(() -> new AccessDeniedException("메뉴를 찾을 수 없습니다."))
                .getStore().getId());
    }

    public void assertCanAccessMenuIngredient(Long menuIngredientId) {
        assertCanAccessStore(menuIngredientRepository.findById(menuIngredientId)
                .orElseThrow(() -> new AccessDeniedException("레시피 항목을 찾을 수 없습니다."))
                .getMenu().getStore().getId());
    }

    public void assertCanAccessInventory(Long inventoryId) {
        assertCanAccessStore(inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new AccessDeniedException("재고를 찾을 수 없습니다."))
                .getStore().getId());
    }

    public void assertCanAccessOrder(Long orderId) {
        assertCanAccessStore(orderRequestRepository.findById(orderId)
                .orElseThrow(() -> new AccessDeniedException("발주를 찾을 수 없습니다."))
                .getStore().getId());
    }

    public void assertCanAccessSales(Long salesId) {
        assertCanAccessStore(salesDataRepository.findById(salesId)
                .orElseThrow(() -> new AccessDeniedException("매출 기록을 찾을 수 없습니다."))
                .getStore().getId());
    }

    public void assertCanAccessNotification(Long notificationId) {
        assertCanAccessStore(notificationRepository.findById(notificationId)
                .orElseThrow(() -> new AccessDeniedException("알림을 찾을 수 없습니다."))
                .getStore().getId());
    }
}
