package com.foodguard.entity;

import jakarta.persistence.*;import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
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

    @Column(name = "delivery_group_token", length = 64)
    private String deliveryGroupToken;

    @Column(name = "hq_sent_at")
    private LocalDateTime hqSentAt;

    @Column(name = "driver_received_at")
    private LocalDateTime driverReceivedAt;

    @Column(name = "owner_received_at")
    private LocalDateTime ownerReceivedAt;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "qr_token", length = 64)
    private String qrToken;

    // 발주 생성 시점의 AI 추천량 (추천 대비 실제 발주 비교용). 추천 목록에 없던 식자재는 0
    @Column(name = "recommended_qty", precision = 10, scale = 2)
    private BigDecimal recommendedQty;

    // AUTO(추천 그대로 자동 발주) | MANUAL(점주 직접 입력)
    @Column(name = "order_source", length = 10)
    private String orderSource;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public void setQuantity(Double quantity) {
        this.quantity = quantity;
        this.orderedQty = BigDecimal.valueOf(quantity);
    }
}
