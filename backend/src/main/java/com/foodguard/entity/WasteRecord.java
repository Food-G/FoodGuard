package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 폐기 기록 (D-4). 공용 DB 에 이미 있는 waste_record 테이블에 맞춘다. 기록자는 원장(INVENTORY_TXN.created_by)에 남는다. */
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

    @Column(length = 20)
    private String unit;

    @Column(name = "waste_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal qty;

    @Column(nullable = false, length = 20)
    private String reason;

    @Column(name = "waste_date", nullable = false)
    private LocalDate wasteDate;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
