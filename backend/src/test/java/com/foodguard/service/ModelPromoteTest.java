package com.foodguard.service;

import com.foodguard.controller.AgentController;
import com.foodguard.entity.AgentProposal;
import com.foodguard.repository.AgentRunRepository;
import com.foodguard.repository.InventoryLotRepository;
import com.foodguard.security.AuthUser;
import com.foodguard.security.StoreAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 모델 교체 제안: 실행 결과 분기 + 승인 권한 (DB·Spring 컨텍스트 없음). */
class ModelPromoteTest {

    private PredictionService prediction;
    private ProposalExecutor executor;
    private AgentProposal p;

    @BeforeEach
    void setUp() {
        prediction = mock(PredictionService.class);
        executor = new ProposalExecutor(mock(OrderRequestService.class), mock(NotificationService.class),
                mock(WasteService.class), mock(DonationService.class), prediction,
                mock(InventoryLotRepository.class), mock(RestTemplate.class));
        p = new AgentProposal();
        p.setId(1L);
        p.setType("MODEL_PROMOTE");
        p.setStoreId(60006L);
        p.setFingerprint("c1");
        p.setPayload(new HashMap<>());
    }

    @Test
    void promotesApprovedChallengerAndKeepsArchiveForRollback() {
        doReturn(Map.of("archived", "20261106-070000-000000", "promoted", 3)).when(prediction).promoteChallenger(60006L, "c1");
        Map<String, Object> r = executor.execute(p);
        assertEquals("20261106-070000-000000", r.get("archived"));
        assertEquals(3, r.get("promoted"));
    }

    @Test
    void conflictMeansStale() {
        when(prediction.promoteChallenger(60006L, "c1")).thenThrow(HttpClientErrorException.create(
                HttpStatus.CONFLICT, "Conflict", null, new byte[0], StandardCharsets.UTF_8));
        assertThrows(ProposalExecutor.StaleProposalException.class, () -> executor.execute(p));
    }

    @Test
    void aiServiceDownKeepsProposalPending() {
        when(prediction.promoteChallenger(60006L, "c1")).thenThrow(new ResourceAccessException("down"));
        assertThrows(ProposalExecutor.CheckUnavailableException.class, () -> executor.execute(p));
    }

    @Test
    void withoutFingerprintIsStale() {
        p.setFingerprint(null);
        assertThrows(ProposalExecutor.StaleProposalException.class, () -> executor.execute(p));
        verifyNoInteractions(prediction);
    }

    // ── 승인 권한 ────────────────────────────────────────────────────

    private AgentController controller(String role, AgentProposalService service) {
        StoreAccessGuard guard = mock(StoreAccessGuard.class);
        when(guard.currentUser()).thenReturn(new AuthUser(7L, "u@example.com", role));
        when(service.get(1L)).thenReturn(p);
        return new AgentController(service, mock(AgentRunRepository.class), guard, mock(RestTemplate.class));
    }

    @Test
    void ownerCannotApproveOrRejectModelPromote() {
        AgentProposalService service = mock(AgentProposalService.class);
        AgentController c = controller("OWNER", service);
        assertThrows(AccessDeniedException.class, () -> c.approve(1L));
        assertThrows(AccessDeniedException.class, () -> c.reject(1L, null));
        verify(service, never()).approve(any(), any());
        verify(service, never()).reject(any(), any(), any());
    }

    @Test
    void hqCanApproveModelPromote() {
        AgentProposalService service = mock(AgentProposalService.class);
        controller("HQ_ADMIN", service).approve(1L);
        verify(service).approve(1L, 7L);
    }

    @Test
    void ownerStillApprovesOtherTypes() {
        p.setType("ORDER_CREATE");
        AgentProposalService service = mock(AgentProposalService.class);
        controller("OWNER", service).approve(1L);
        verify(service).approve(1L, 7L);
    }
}
