package com.foodguard;

import com.foodguard.config.SecurityConfig;
import com.foodguard.controller.OrderRequestController;
import com.foodguard.controller.StoreController;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.Store;
import com.foodguard.repository.StoreRepository;
import com.foodguard.service.OrderRequestService;
import com.foodguard.service.StoreAccessService;
import com.foodguard.service.StoreService;
import com.foodguard.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 점주 토큰으로 본사 API·다른 매장 데이터를 호출하면 403, 본사와 자기 매장은 통과하는지 확인
@WebMvcTest(controllers = {OrderRequestController.class, StoreController.class})
@Import({SecurityConfig.class, JwtUtil.class, StoreAccessService.class})
@TestPropertySource(properties = {
        "jwt.secret=unit-test-only-jwt-secret-0123456789abcdef",
        "jwt.expiration=3600000"
})
class AccessControlTest {

    private static final long OWNER_ID = 10L;
    private static final long MY_STORE = 1L;
    private static final long OTHER_STORE = 2L;
    private static final long OTHER_STORE_ORDER = 100L;

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockitoBean OrderRequestService orderRequestService;
    @MockitoBean StoreService storeService;
    @MockitoBean StoreRepository storeRepository;

    private String ownerToken;
    private String hqToken;

    @BeforeEach
    void setUp() {
        ownerToken = "Bearer " + jwtUtil.generateToken("owner@test.com", "OWNER", OWNER_ID);
        hqToken = "Bearer " + jwtUtil.generateToken("hq@test.com", "HQ_ADMIN", 99L);
        when(storeRepository.existsByIdAndUserId(MY_STORE, OWNER_ID)).thenReturn(true);
        when(orderRequestService.getById(OTHER_STORE_ORDER)).thenReturn(orderOf(OTHER_STORE));
        when(orderRequestService.getByQrToken("other-store-qr")).thenReturn(orderOf(OTHER_STORE));
    }

    @Test
    @DisplayName("점주는 본사 전용 API를 호출할 수 없다")
    void ownerCannotCallHqApis() throws Exception {
        expectStatus(get("/api/orders/admin/all").header("Authorization", ownerToken), 403);
        expectStatus(post("/api/orders/" + OTHER_STORE_ORDER + "/hq-send").header("Authorization", ownerToken), 403);
        expectStatus(get("/api/stores").header("Authorization", ownerToken), 403);
        expectStatus(delete("/api/stores/" + MY_STORE).header("Authorization", ownerToken), 403);
        expectStatus(statusChange("APPROVED", ownerToken), 403);
        expectStatus(statusChange("REJECTED", ownerToken), 403);
        verify(orderRequestService, never()).updateStatus(any(), any());
    }

    @Test
    @DisplayName("본사 관리자는 본사 전용 API와 모든 매장 데이터를 호출할 수 있다")
    void hqCanCallHqApis() throws Exception {
        expectStatus(get("/api/orders/admin/all").header("Authorization", hqToken), 200);
        expectStatus(get("/api/stores").header("Authorization", hqToken), 200);
        expectStatus(statusChange("APPROVED", hqToken), 200);
        expectStatus(get("/api/orders/" + OTHER_STORE).header("Authorization", hqToken), 200);
    }

    @Test
    @DisplayName("점주는 다른 매장 데이터에 접근할 수 없다")
    void ownerCannotAccessOtherStore() throws Exception {
        expectStatus(get("/api/orders/" + OTHER_STORE).header("Authorization", ownerToken), 403);
        expectStatus(get("/api/orders/recommend/" + OTHER_STORE).header("Authorization", ownerToken), 403);
        expectStatus(post("/api/orders/auto/" + OTHER_STORE).header("Authorization", ownerToken), 403);
        expectStatus(delete("/api/orders/" + OTHER_STORE_ORDER).header("Authorization", ownerToken), 403);
        expectStatus(get("/api/stores/my/" + (OWNER_ID + 1)).header("Authorization", ownerToken), 403);
        verify(orderRequestService, never()).cancel(any());
    }

    @Test
    @DisplayName("점주는 자기 매장 데이터에 접근할 수 있다")
    void ownerCanAccessOwnStore() throws Exception {
        expectStatus(get("/api/orders/" + MY_STORE).header("Authorization", ownerToken), 200);
        expectStatus(get("/api/stores/my/" + OWNER_ID).header("Authorization", ownerToken), 200);
    }

    @Test
    @DisplayName("owner-scan은 로그인과 매장 소유 확인을 요구한다")
    void ownerScanRequiresLoginAndOwnership() throws Exception {
        expectStatus(get("/api/orders/owner-scan").param("token", "other-store-qr"), 403);
        expectStatus(get("/api/orders/owner-scan").param("token", "other-store-qr")
                .header("Authorization", ownerToken), 403);
        verify(orderRequestService, never()).ownerQrScan(any());
    }

    private RequestBuilder statusChange(String status, String token) {
        return put("/api/orders/" + OTHER_STORE_ORDER + "/status")
                .header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + status + "\"}");
    }

    private void expectStatus(RequestBuilder request, int expected) throws Exception {
        mockMvc.perform(request).andExpect(status().is(expected));
    }

    private static OrderRequest orderOf(long storeId) {
        Store store = new Store();
        store.setId(storeId);
        OrderRequest order = new OrderRequest();
        order.setStore(store);
        return order;
    }
}
