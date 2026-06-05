package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    // 실제 order_request 테이블에 prediction_id 컬럼이 없어 @Transient 처리 (미사용 필드)
    @Transient
    private Long predictionId;

    @Column(nullable = false)
    private String status;

    @Column(name = "ordered_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal orderedQty;

    @Transient
    private Double quantity;

    @Column(name = "ordered_at")
    private LocalDateTime orderedAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "delivery_token", length = 64)
    private String deliveryToken;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public void setQuantity(Double quantity) {
        this.quantity = quantity;
        this.orderedQty = BigDecimal.valueOf(quantity);
    }
}
