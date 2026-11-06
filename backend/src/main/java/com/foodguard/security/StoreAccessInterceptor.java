package com.foodguard.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

import java.util.Map;

import static java.util.Map.entry;

/**
 * 경로의 {storeId}·{userId}·?storeId= 와, 엔티티 {id}·{menuId} 가 가리키는 매장을 StoreAccess 로 검사한다.
 * 요청 본문의 storeId·userId·menuId 는 StoreAccessBodyAdvice 가 검사한다.
 * 새 컨트롤러에 엔티티 {id} 경로를 만들면 ID_ENTITY 에 추가해야 한다.
 */
@Component
@RequiredArgsConstructor
public class StoreAccessInterceptor implements HandlerInterceptor {

    // 경로 패턴 → {id}(또는 {menuId}) 가 가리키는 엔티티
    static final Map<String, String> ID_ENTITY = Map.ofEntries(
            entry("/api/menus/{id}", "Menu"),
            entry("/api/menu-ingredients/{id}", "MenuIngredient"),
            entry("/api/menu-ingredients/menu/{menuId}", "Menu"),
            entry("/api/ingredients/{id}", "Ingredient"),
            entry("/api/notifications/{id}/read", "Notification"),
            entry("/api/orders/{id}", "OrderRequest"),
            entry("/api/orders/{id}/driver-receive", "OrderRequest"),
            entry("/api/orders/{id}/hq-send", "OrderRequest"),
            entry("/api/orders/{id}/status", "OrderRequest"),
            entry("/api/sales-flags/{id}", "SalesDayFlag"),
            entry("/api/event-notes/{id}", "StoreEventNote"),
            entry("/api/discounts/{id}", "MenuDiscount"),
            entry("/api/donations/{id}/complete", "DonationRecord"),
            entry("/api/donations/{id}/cancel", "DonationRecord")
    );

    private final StoreAccess storeAccess;

    @Override
    @SuppressWarnings("unchecked")
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        Map<String, String> vars = (Map<String, String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        String pattern = (String) request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);

        if (vars != null) {
            if (vars.containsKey("storeId")) storeAccess.checkStore(Long.valueOf(vars.get("storeId")));
            if (vars.containsKey("userId")) storeAccess.checkUser(Long.valueOf(vars.get("userId")));
            if ("/api/stores/{id}".equals(pattern)) storeAccess.checkStore(Long.valueOf(vars.get("id")));
            String entity = ID_ENTITY.get(pattern);
            if (entity != null) {
                String id = vars.containsKey("id") ? vars.get("id") : vars.get("menuId");
                storeAccess.checkEntity(entity, Long.valueOf(id));
            }
        }
        String storeIdParam = request.getParameter("storeId");
        if (storeIdParam != null) storeAccess.checkStore(Long.valueOf(storeIdParam));
        return true;
    }
}
