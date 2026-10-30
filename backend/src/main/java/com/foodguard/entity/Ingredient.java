package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "INGREDIENT")
@Getter @Setter
@NoArgsConstructor
public class Ingredient {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ingredient_id")
    private Long id;

    @Column(name = "ingredient_name", nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(length = 50)
    private String category;

    /** 보관일수 (D-3). NULL = 유통기한 관리 안 함. 값은 ai-service/seed_shelf_life.py 로 넣는다 (앱에서는 읽기만). */
    @Column(name = "shelf_life_days", insertable = false, updatable = false)
    private Integer shelfLifeDays;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
