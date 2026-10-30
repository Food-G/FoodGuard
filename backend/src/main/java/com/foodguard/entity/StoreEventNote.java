package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// 점주 특이사항 메모와, 저장 시점에 claude 가 바꾼 숫자 (AI 수요 예측의 event_lift 피처)
@Entity
@Table(name = "STORE_EVENT_NOTE")
@Getter @Setter
@NoArgsConstructor
public class StoreEventNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "note_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(nullable = false, length = 500)
    private String note;

    // RESERVATION | LOCAL_EVENT | PROMOTION | WEATHER | SUPPLY | OTHER
    @Column(name = "event_type", length = 20)
    private String eventType;

    // 그날 매장 전체 판매량 예상 배율 (평소 1.0)
    @Column(name = "event_lift", precision = 4, scale = 2)
    private BigDecimal eventLift;

    @Column(length = 300)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
