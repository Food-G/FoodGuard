package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

// 실제 폐기량 기록 — 폐기율 절감 효과 측정의 기준 데이터
@Entity
@Table(name = "WASTE_RECORD")
@Getter @Setter
@NoArgsConstructor
public class WasteRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "waste_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "ingredient_id", nullable = false)
    private Long ingredientId;

    @Column(name = "ingredient_name", length = 100)
    private String ingredientName;

    // 예전 WasteRecord 엔티티가 만든 테이블이 DB에 남아 있어 그 컬럼명(waste_qty)을 그대로 쓴다
    @Column(name = "waste_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(length = 20)
    private String unit;

    // EXPIRED(유통기한 경과) | SPOILED(변질·파손) | OTHER
    @Column(nullable = false, length = 20)
    private String reason;

    @Column(name = "waste_date", nullable = false)
    private LocalDate wasteDate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
