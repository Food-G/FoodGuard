package com.foodguard.service;

import com.foodguard.entity.AgentProposal;
import com.foodguard.repository.AgentProposalRepository;
import com.foodguard.repository.StoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 제안 승인 결과 분기 (DB·Spring 컨텍스트 없음). */
class AgentProposalServiceTest {

    private AgentProposalRepository repo;
    private ProposalExecutor executor;
    private AgentProposalService service;
    private AgentProposal p;

    @BeforeEach
    void setUp() {
        repo = mock(AgentProposalRepository.class);
        executor = mock(ProposalExecutor.class);
        service = new AgentProposalService(repo, mock(StoreRepository.class), executor);
        p = new AgentProposal();
        p.setId(1L);
        p.setType("ORDER_CREATE");
        p.setStatus("PENDING");
        p.setExpiresAt(LocalDateTime.now().plusHours(1));
        when(repo.findById(1L)).thenReturn(Optional.of(p));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void auditReportIsAcceptedAndChangesNothing() {
        assertTrue(AgentProposalService.TYPES.contains("AUDIT_REPORT"));
        OrderRequestService orders = mock(OrderRequestService.class);
        p.setType("AUDIT_REPORT");
        Map<String, Object> r = new ProposalExecutor(orders, mock(NotificationService.class), mock(WasteService.class),
                mock(DonationService.class), mock(PredictionService.class),
                mock(com.foodguard.repository.InventoryLotRepository.class),
                mock(org.springframework.web.client.RestTemplate.class)).execute(p);
        assertEquals(true, r.get("ok"));
        verifyNoInteractions(orders);
    }

    @Test
    void executedOnSuccess() {
        when(executor.execute(p)).thenReturn(Map.of("ok", true));
        AgentProposal r = service.approve(1L, 7L);
        assertEquals("EXECUTED", r.getStatus());
        assertEquals(7L, r.getDecidedBy());
    }

    @Test
    void staleWhenFingerprintChanged() {
        when(executor.execute(p)).thenThrow(new ProposalExecutor.StaleProposalException("바뀜"));
        AgentProposal r = service.approve(1L, 7L);
        assertEquals("STALE", r.getStatus());
        assertEquals("바뀜", r.getExecResult().get("error"));
    }

    @Test
    void failedOnExecutionError() {
        when(executor.execute(p)).thenThrow(new IllegalStateException("발주량이 0 이하"));
        assertEquals("FAILED", service.approve(1L, 7L).getStatus());
    }

    @Test
    void checkUnavailableKeepsPending() {
        when(executor.execute(p)).thenThrow(new ProposalExecutor.CheckUnavailableException("다운"));
        assertThrows(IllegalStateException.class, () -> service.approve(1L, 7L));
        verify(repo, never()).save(any());  // 롤백 대상 — 저장하지 않는다
    }

    @Test
    void cannotDecideTwiceOrAfterExpiry() {
        p.setStatus("EXECUTED");
        assertThrows(IllegalStateException.class, () -> service.approve(1L, 7L));
        p.setStatus("PENDING");
        p.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        assertThrows(IllegalStateException.class, () -> service.reject(1L, 7L, "x"));
        verify(executor, never()).execute(any());
    }
}
