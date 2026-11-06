package com.foodguard.service;

import com.foodguard.controller.AgentController;
import com.foodguard.repository.AgentRunRepository;
import com.foodguard.security.StoreAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Copilot 프록시: 사용자 토큰 전달과 매장 검사 (DB·Spring 컨텍스트 없음). */
class AgentChatTest {

    private StoreAccessGuard guard;
    private RestTemplate rest;
    private AgentController controller;

    @BeforeEach
    void setUp() {
        guard = mock(StoreAccessGuard.class);
        rest = mock(RestTemplate.class);
        controller = new AgentController(mock(AgentProposalService.class), mock(AgentRunRepository.class), guard, rest);
        ReflectionTestUtils.setField(controller, "agentServiceUrl", "http://agent");
    }

    private static Map<String, Object> body(Object storeId) {
        Map<String, Object> b = new HashMap<>();
        b.put("question", "폐기 위험 TOP3");
        b.put("storeId", storeId);
        return b;
    }

    @Test
    @SuppressWarnings("unchecked")
    void forwardsCallersOwnTokenAndChecksStore() {
        doReturn(Map.of("answer", "a")).when(rest).postForObject(anyString(), any(), eq(Map.class));

        ResponseEntity<?> r = controller.chat(body(60006), "Bearer user-jwt");

        assertEquals(200, r.getStatusCode().value());
        verify(guard).assertCanAccessStore(60006L);
        ArgumentCaptor<HttpEntity<Map<String, Object>>> sent = ArgumentCaptor.forClass(HttpEntity.class);
        verify(rest).postForObject(eq("http://agent/chat"), sent.capture(), eq(Map.class));
        assertEquals("user-jwt", sent.getValue().getHeaders().getFirst("X-User-Token"));
        assertEquals("폐기 위험 TOP3", sent.getValue().getBody().get("question"));
        assertEquals(List.of(), sent.getValue().getBody().get("history"));
    }

    @Test
    void otherStoreIsRejectedBeforeCallingAgentService() {
        doThrow(new AccessDeniedException("본인 매장이 아닙니다.")).when(guard).assertCanAccessStore(1L);
        assertThrows(AccessDeniedException.class, () -> controller.chat(body(1), "Bearer t"));
        verifyNoInteractions(rest);
    }

    @Test
    void hqWithoutStoreIsAllowed() {
        doReturn(Map.of()).when(rest).postForObject(anyString(), any(), eq(Map.class));
        assertEquals(200, controller.chat(body(null), "Bearer t").getStatusCode().value());
        verify(guard, never()).assertCanAccessStore(any());
    }

    @Test
    void agentServiceFailureBecomes502WithoutLeakingDetails() {
        when(rest.postForObject(anyString(), any(), eq(Map.class)))
                .thenThrow(new HttpServerErrorException(HttpStatus.BAD_GATEWAY, "내부 오류 상세"));
        ResponseEntity<?> r = controller.chat(body(null), "Bearer t");
        assertEquals(502, r.getStatusCode().value());
        assertFalse(r.getBody().toString().contains("내부 오류 상세"));
    }

    @Test
    void agentServiceDownBecomes502() {
        when(rest.postForObject(anyString(), any(), eq(Map.class))).thenThrow(new ResourceAccessException("down"));
        assertEquals(502, controller.chat(body(null), "Bearer t").getStatusCode().value());
    }
}
