package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/** 에이전트 1회 실행 기록. run_id 는 agent-service 가 발급한다 (로컬 agent-runs/*.json 과 같은 id). */
@Entity
@Table(name = "AGENT_RUN")
@Getter @Setter
@NoArgsConstructor
public class AgentRun {
    @Id
    @Column(name = "run_id", length = 36)
    private String runId;

    @Column(nullable = false)
    private String agent;

    @Column(name = "store_id")
    private Long storeId;

    @Column(name = "trigger_type", nullable = false)
    private String triggerType; // SCHEDULE, EVENT, MANUAL, CHAT

    @Column(nullable = false)
    private String status; // RUNNING, OK, FAILED

    private String model;

    @Column(name = "input_tokens")
    private Integer inputTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_json", columnDefinition = "json")
    private Map<String, Object> resultJson;

    @Column(columnDefinition = "TEXT")
    private String error;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;
}
