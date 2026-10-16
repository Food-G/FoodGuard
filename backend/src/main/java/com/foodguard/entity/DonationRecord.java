package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    // FOOD | INGREDIENT
    @Column(name = "donation_type", nullable = false, length = 20)
    private String donationType;

    @Column(name = "org_name", nullable = false, length = 100)
    private String orgName;

    // ORPHANAGE | NURSING_HOME | FOOD_BANK | OTHER
    @Column(name = "org_type", nullable = false, length = 30)
    private String orgType;

    @Column(name = "org_contact", length = 100)
    private String orgContact;

    @Column(precision = 10, scale = 2)
    private BigDecimal quantity;

    @Column(length = 20)
    private String unit;

    @Column(columnDefinition = "TEXT")
    private String description;

    // PLANNED | COMPLETED | CANCELLED
    @Column(nullable = false, length = 20)
    private String status = "PLANNED";

    @Column(name = "donated_at")
    private LocalDateTime donatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
