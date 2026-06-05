package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "MENU_INGREDIENT")
@Getter @Setter
@NoArgsConstructor
public class MenuIngredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_ingredient_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ingredient_id", nullable = false)
    private Ingredient ingredient;

    @Column(name = "qty_per_unit", nullable = false, precision = 10, scale = 2)
    private BigDecimal qtyPerUnit;

    @Column(nullable = false, length = 20)
    private String unit;

    // 레시피 오차범위(%) — 조리 손실/편차 반영용. 소모 차감 시 (1 + tolerance/100) 적용
    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal tolerance = BigDecimal.ZERO;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
