package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "sales_data")
@Getter @Setter @NoArgsConstructor
public class SalesData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @Column(nullable = false)
    private Integer quantity;            // 판매 수량

    @Column(nullable = false)
    private Integer totalPrice;          // 총 매출 금액

    @Column(nullable = false)
    private LocalDate saleDate;          // 판매 날짜

    private Boolean isDeleted = false;   // Soft Delete 지원

    private LocalDateTime deletedAt;     // 삭제 시각
}