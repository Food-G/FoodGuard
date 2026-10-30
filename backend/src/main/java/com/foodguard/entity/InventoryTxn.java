package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 재고 원장 1행. InventoryLedger 만 쓴다. */
@Entity
@Table(name = "INVENTORY_TXN")
@Getter @Setter
@NoArgsConstructor
public class InventoryTxn {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "txn_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "ingredient_id", nullable = false)
    private Long ingredientId;

    @Column(name = "delta_qty", nullable = false, precision = 12, scale = 3)
    private BigDecimal deltaQty;

    @Column(nullable = false)
    private String reason; // SALE, ORDER_DONE, WASTE, DONATION, ADJUST, INIT

    @Column(name = "ref_type")
    private String refType;

    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "qty_after", precision = 12, scale = 3)
    private BigDecimal qtyAfter;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;
}
