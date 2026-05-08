package com.foodguard.entity;

<<<<<<< HEAD
import com.fasterxml.jackson.annotation.JsonIgnore;
=======
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
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

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user"})
    private Store store;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ingredient_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Ingredient ingredient;

    @Column(name = "current_qty", nullable = false, precision = 10, scale = 2)
    private BigDecimal currentQty;

    @Transient
    private Double quantity;

    @Column(name = "min_threshold", nullable = false, precision = 10, scale = 2)
    private BigDecimal minThreshold;

    @Column(nullable = false, length = 20)
    private String unit;

<<<<<<< HEAD
    @Column(name = "updated_at")
=======
    // 재고 단가 (원)
    @Column(precision = 12, scale = 2)
    private BigDecimal price;

    // 유통기한
    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    // 등록일시 (자동 기록)
    @Column(name = "registered_at")
    private LocalDateTime registeredAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    private LocalDateTime updatedAt;

    public void setQuantity(Double quantity) {
        this.quantity = quantity;
        this.currentQty = BigDecimal.valueOf(quantity);
    }
}
