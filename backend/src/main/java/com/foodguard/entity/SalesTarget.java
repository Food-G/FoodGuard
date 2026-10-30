package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

// 점주가 정한 주간 목표 매출 (매출 계획 수립 지원: AI 예측 매출과 비교)
@Entity
@Table(name = "SALES_TARGET")
@Getter @Setter
@NoArgsConstructor
public class SalesTarget {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "target_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    // 그 주의 월요일
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    // 원
    @Column(name = "target_amount", nullable = false)
    private Long targetAmount;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
