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

<<<<<<< HEAD
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "ingredient_id", nullable = false)
=======
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "store"})
    private Menu menu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ingredient_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    private Ingredient ingredient;

    @Column(name = "qty_per_unit", nullable = false, precision = 10, scale = 2)
    private BigDecimal qtyPerUnit;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
