package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 입고 로트 (D-3). InventoryLedger 만 쓴다. */
@Entity
@Table(name = "INVENTORY_LOT")
@Getter @Setter
@NoArgsConstructor
public class InventoryLot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "lot_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "ingredient_id", nullable = false)
    private Long ingredientId;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "received_qty", nullable = false, precision = 12, scale = 3)
    private BigDecimal receivedQty;

    @Column(name = "remaining_qty", nullable = false, precision = 12, scale = 3)
    private BigDecimal remainingQty;

    @Column(name = "received_at", nullable = false)
    private LocalDateTime receivedAt;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;
}
