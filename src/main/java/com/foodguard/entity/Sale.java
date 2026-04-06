package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "sales")
@Getter @Setter
@NoArgsConstructor
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String menuName;      // 메뉴 이름

    @Column(nullable = false)
    private Integer quantity;     // 판매 수량

    @Column(nullable = false)
    private Integer price;        // 판매 금액

    @Column(nullable = false)
    private LocalDate saleDate;   // 판매 날짜

    @Column(nullable = false)
    private String storeId;       // 가맹점 ID
}