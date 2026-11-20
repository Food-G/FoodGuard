package com.foodguard.security;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static java.util.Map.entry;

/**
 * 점주는 자기 매장 데이터만, 본사 관리자(HQ_ADMIN)는 모든 매장 데이터에 접근한다.
 * 매장 주인 = STORE.hq_user_id (Store.user). 위반 시 AccessDeniedException → 403
 */
@Component
@RequiredArgsConstructor
public class StoreAccess {

    // 엔티티 id 로 소속 매장 id 를 찾는 쿼리 (경로의 {id}·{menuId} 가 가리키는 엔티티별)
    static final Map<String, String> STORE_ID_QUERY = Map.ofEntries(
            entry("Inventory", "select x.store.id from Inventory x where x.id = :id"),
            entry("Menu", "select x.store.id from Menu x where x.id = :id"),
            entry("MenuIngredient", "select x.menu.store.id from MenuIngredient x where x.id = :id"),
            entry("Ingredient", "select x.store.id from Ingredient x where x.id = :id"),
            entry("Notification", "select x.store.id from Notification x where x.id = :id"),
            entry("OrderRequest", "select x.store.id from OrderRequest x where x.id = :id"),
            entry("SalesData", "select x.store.id from SalesData x where x.id = :id"),
            entry("SalesDayFlag", "select x.storeId from SalesDayFlag x where x.id = :id"),
            entry("StoreEventNote", "select x.storeId from StoreEventNote x where x.id = :id"),
            entry("DonationRecord", "select x.storeId from DonationRecord x where x.id = :id"),
            entry("MenuDiscount", "select x.storeId from MenuDiscount x where x.id = :id")
    );

    private final EntityManager entityManager;

    // 로그인하지 않은 요청(permitAll 경로)은 null
    public AuthUser currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getDetails() instanceof AuthUser user ? user : null;
    }

    public void checkStore(Long storeId) {
        AuthUser user = currentUser();
        if (user == null || user.isHqAdmin() || storeId == null) return;
        List<Long> owners = entityManager
                .createQuery("select s.user.id from Store s where s.id = :id", Long.class)
                .setParameter("id", storeId)
                .getResultList();
        // 없는 매장은 컨트롤러가 404/400 으로 처리하도록 통과
        if (!owners.isEmpty() && !user.id().equals(owners.get(0))) {
            throw new AccessDeniedException("다른 가맹점의 데이터에는 접근할 수 없습니다.");
        }
    }

    public void checkUser(Long userId) {
        AuthUser user = currentUser();
        if (user == null || user.isHqAdmin() || userId == null) return;
        if (!user.id().equals(userId)) {
            throw new AccessDeniedException("다른 사용자의 데이터에는 접근할 수 없습니다.");
        }
    }

    // entity 의 id 로 소속 매장을 찾아 검사. 매장이 없는 공용 데이터(store_id 가 빈 기존 식자재)는 통과
    public void checkEntity(String entity, Long id) {
        if (currentUser() == null || id == null) return;
        List<Long> storeIds = entityManager.createQuery(STORE_ID_QUERY.get(entity), Long.class)
                .setParameter("id", id)
                .getResultList();
        if (!storeIds.isEmpty()) checkStore(storeIds.get(0));
    }
}
