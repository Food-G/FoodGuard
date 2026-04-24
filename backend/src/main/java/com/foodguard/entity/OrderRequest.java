package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "ORDER_REQUEST")
@Getter @Setter
@NoArgsConstructor
public class OrderRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "prediction_id")
    private Long predictionId;

    @Column(nullable = false)
    private String status; // REQUESTED, APPROVED, REJECTED, DONE

    @Column(name = "ordered_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal orderedQty;
    
    // 서비스 대응용
    @Transient
    private Double quantity;

    @Column(name = "ordered_at", insertable = false, updatable = false)
    private LocalDateTime orderedAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public void setQuantity(Double quantity) {
        this.quantity = quantity;
        this.orderedQty = BigDecimal.valueOf(quantity);
    }
}
