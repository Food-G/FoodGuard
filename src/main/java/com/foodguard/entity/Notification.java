package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "notification")
@Getter @Setter @NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(nullable = false)
    private String message;              // 알림 내용

    private String type;                // 알림 유형 (재고부족/발주승인 등)

    private Boolean isRead = false;     // 읽음 여부

    private LocalDateTime createdAt = LocalDateTime.now();
}