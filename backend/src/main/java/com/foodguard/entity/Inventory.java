package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "INVENTORY")
@Getter @Setter
@NoArgsConstructor
public class Inventory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "inventory_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "current_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal currentQty;

    // 서비스에서 사용하는 필드명 및 타입 대응
    @Transient
    private Double quantity;

    @Column(name = "min_threshold", nullable = false, precision = 10, scale = 2)
    private BigDecimal minThreshold;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
    
    // 호환성을 위한 Getter/Setter 수동 추가 가능 (Lombok이 처리 못하는 경우 대비)
    public void setQuantity(Double quantity) {
        this.quantity = quantity;
        this.currentQty = BigDecimal.valueOf(quantity);
    }
}
