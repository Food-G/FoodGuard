package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "SALES_DATA")
@Getter @Setter
@NoArgsConstructor
public class SalesData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sales_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user"})
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "store"})
    private Menu menu;

    @Column(name = "sales_date", nullable = false)
    private LocalDate saleDate;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @Transient
    private Integer totalPrice;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public void setIsDeleted(boolean isDeleted) { this.isDeleted = isDeleted; }
}
