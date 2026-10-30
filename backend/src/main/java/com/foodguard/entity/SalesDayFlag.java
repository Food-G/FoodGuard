package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

// 판매량을 수요로 볼 수 없는 날 기록 — AI 서비스가 학습·예측에서 읽는다
@Entity
@Table(name = "SALES_DAY_FLAG")
@Getter @Setter
@NoArgsConstructor
public class SalesDayFlag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "flag_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    // SOLD_OUT 일 때만 값이 있음 (CLOSED 는 매장 전체)
    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "flag_date", nullable = false)
    private LocalDate flagDate;

    // CLOSED(휴무: 학습 제외, 예측 0) | SOLD_OUT(품절: 판매량 < 수요라 학습 정답에서 제외)
    @Column(name = "flag_type", nullable = false, length = 20)
    private String flagType;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
