package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ingredient")
@Getter @Setter @NoArgsConstructor
public class Ingredient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;                 // 식자재 이름 (ex: 돼지고기)

    private String category;            // 분류 (육류/채소/소스 등)

    private String unit;                // 단위 (kg, 개, L)
}