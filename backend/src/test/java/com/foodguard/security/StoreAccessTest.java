package com.foodguard.security;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.HandlerMapping;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// DB 없이 매장 소유 검사 규칙만 검증 (점주 7번이 매장 1의 주인, 매장 2는 다른 점주 8번)
class StoreAccessTest {

    private final EntityManager em = mock(EntityManager.class);
    private final StoreAccess access = new StoreAccess(em);

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void login(long userId, String role) {
        var auth = new UsernamePasswordAuthenticationToken("u@test", null, List.of());
        auth.setDetails(new AuthUser(userId, role));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @SuppressWarnings("unchecked")
    private void owners(Map<Long, Long> storeToOwner) {
        when(em.createQuery(anyString(), eq(Long.class))).thenAnswer(inv -> {
            TypedQuery<Long> q = mock(TypedQuery.class);
            String jpql = inv.getArgument(0);
            when(q.setParameter(eq("id"), any())).thenAnswer(p -> {
                Long id = p.getArgument(1);
                List<Long> result = jpql.contains("from Store")
                        ? (storeToOwner.containsKey(id) ? List.of(storeToOwner.get(id)) : List.of())
                        : List.of(2L);  // 엔티티 쿼리: 매장 2 소속이라고 가정
                when(q.getResultList()).thenReturn(result);
                return q;
            });
            return q;
        });
    }

    @Test
    void 점주는_자기_매장만_접근한다() {
        owners(Map.of(1L, 7L, 2L, 8L));
        login(7, "OWNER");
        assertThatCode(() -> access.checkStore(1L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> access.checkStore(2L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> access.checkEntity("Inventory", 99L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> access.checkUser(8L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void 본사_관리자와_비로그인_경로는_검사하지_않는다() {
        owners(Map.of(2L, 8L));
        login(1, "HQ_ADMIN");
        assertThatCode(() -> access.checkStore(2L)).doesNotThrowAnyException();
        SecurityContextHolder.clearContext();
        assertThatCode(() -> access.checkStore(2L)).doesNotThrowAnyException();
    }

    @Test
    void 인터셉터는_경로의_storeId와_엔티티_id를_검사한다() {
        StoreAccess mockAccess = mock(StoreAccess.class);
        StoreAccessInterceptor interceptor = new StoreAccessInterceptor(mockAccess);

        MockHttpServletRequest byStore = new MockHttpServletRequest();
        byStore.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("storeId", "5"));
        byStore.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/inventory/{storeId}");
        interceptor.preHandle(byStore, null, null);
        verify(mockAccess).checkStore(5L);

        MockHttpServletRequest byId = new MockHttpServletRequest();
        byId.setAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, Map.of("id", "42"));
        byId.setAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE, "/api/orders/{id}/owner-receive");
        interceptor.preHandle(byId, null, null);
        verify(mockAccess).checkEntity("OrderRequest", 42L);

        MockHttpServletRequest byParam = new MockHttpServletRequest();
        byParam.setParameter("storeId", "6");
        interceptor.preHandle(byParam, null, null);
        verify(mockAccess).checkStore(6L);
    }

    @Test
    void 본문의_storeId_userId_menuId를_검사한다() {
        StoreAccess mockAccess = mock(StoreAccess.class);
        new StoreAccessBodyAdvice(mockAccess).afterBodyRead(
                Map.of("storeId", 3, "userId", "9", "menuId", 11), null, null, null, null);
        verify(mockAccess).checkStore(3L);
        verify(mockAccess).checkUser(9L);
        verify(mockAccess).checkEntity("Menu", 11L);
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}
