package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 기부 기록 (AG-3). 공용 DB 에 이미 있는 donation_record 테이블에 맞춘다. 기관 정보는 등록 시점 값으로 남긴다. */
@Entity
@Table(name = "DONATION_RECORD")
@Getter @Setter
@NoArgsConstructor
public class DonationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "donation_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "ingredient_id")
    private Long ingredientId;

    @Column(name = "ingredient_name", length = 100)
    private String ingredientName;

    @Column(length = 20)
    private String unit;

    @Column(precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(name = "donation_type", nullable = false, length = 20)
    private String donationType;

    @Column(name = "org_name", nullable = false, length = 100)
    private String orgName;

    @Column(name = "org_type", nullable = false, length = 30)
    private String orgType;

    @Column(name = "org_contact", length = 100)
    private String orgContact;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "donated_at")
    private LocalDateTime donatedAt;
}
