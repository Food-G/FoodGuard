package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * 에이전트 제안. 에이전트는 업무 데이터를 직접 쓰지 않고 제안만 만든다 (DEV_ROADMAP R5).
 * 사람이 승인하면 ProposalExecutor 가 payload 대로 실행한다.
 */
@Entity
@Table(name = "AGENT_PROPOSAL")
@Getter @Setter
@NoArgsConstructor
public class AgentProposal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "proposal_id")
    private Long id;

    @Column(name = "run_id", nullable = false, length = 36)
    private String runId;

    @Column(nullable = false)
    private String agent;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(nullable = false)
    private String type; // ORDER_CREATE, WASTE_RECORD, DONATION_CREATE, DISCOUNT_SUGGEST, MODEL_PROMOTE, ORDER_FLAG

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "json")
    private Map<String, Object> payload;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String rationale;

    private String fingerprint;

    @Column(nullable = false)
    private String status; // PENDING, APPROVED, REJECTED, EXECUTED, FAILED, STALE, EXPIRED

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "decided_by")
    private Long decidedBy;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exec_result", columnDefinition = "json")
    private Map<String, Object> execResult;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
