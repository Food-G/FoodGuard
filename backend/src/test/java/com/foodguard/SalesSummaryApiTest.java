package com.foodguard;

import com.foodguard.config.SecurityConfig;
import com.foodguard.controller.SalesDataController;
import com.foodguard.repository.StoreRepository;
import com.foodguard.service.SalesDataService;
import com.foodguard.service.StoreAccessService;
import com.foodguard.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// 본사 대시보드의 전체 가맹점 주간 매출 API: 응답 형태 {storeId: 금액}과 본사 전용 권한 확인
@WebMvcTest(controllers = SalesDataController.class)
@Import({SecurityConfig.class, JwtUtil.class, StoreAccessService.class})
@TestPropertySource(properties = {
        "jwt.secret=unit-test-only-jwt-secret-0123456789abcdef",
        "jwt.expiration=3600000"
})
class SalesSummaryApiTest {

    private static final String URL = "/api/sales/all-stores/weekly-summary";

    @Autowired MockMvc mockMvc;
    @Autowired JwtUtil jwtUtil;

    @MockitoBean SalesDataService salesDataService;
    @MockitoBean StoreRepository storeRepository;

    @Test
    @DisplayName("본사 관리자는 가맹점별 주간 매출을 {storeId: 금액} 형태로 받는다")
    void hqGetsRevenueByStore() throws Exception {
        Map<Long, Long> revenue = new LinkedHashMap<>();
        revenue.put(1L, 150000L);
        revenue.put(2L, 98000L);
        when(salesDataService.getAllStoreWeeklyRevenue()).thenReturn(revenue);

        mockMvc.perform(get(URL).header("Authorization", bearer("HQ_ADMIN", 99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['1']").value(150000))
                .andExpect(jsonPath("$['2']").value(98000));
    }

    @Test
    @DisplayName("점주는 전체 가맹점 매출을 볼 수 없다")
    void ownerIsForbidden() throws Exception {
        mockMvc.perform(get(URL).header("Authorization", bearer("OWNER", 10L)))
                .andExpect(status().isForbidden());
        verify(salesDataService, never()).getAllStoreWeeklyRevenue();
    }

    private String bearer(String role, long userId) {
        return "Bearer " + jwtUtil.generateToken(role.toLowerCase() + "@test.com", role, userId);
    }
}
