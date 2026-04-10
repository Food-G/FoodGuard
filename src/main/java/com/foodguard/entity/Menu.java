package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "menu")
@Getter @Setter @NoArgsConstructor
public class Menu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;                  // 가맹점 연결

    @Column(nullable = false)
    private String menuName;              // 메뉴 이름

    @Column(nullable = false)
    private Integer price;                // 가격

    private String category;             // 카테고리 (메인/사이드/음료)

    private Boolean isActive = true;     // 판매 여부
}