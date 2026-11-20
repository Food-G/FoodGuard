package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

// 유통기한 임박 식자재를 소진하려고 점주가 건 메뉴 할인. POS 결제가 이 기간의 할인가로 판매를 기록한다
@Entity
@Table(name = "MENU_DISCOUNT")
@Getter @Setter
@NoArgsConstructor
public class MenuDiscount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "discount_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "menu_id", nullable = false)
    private Long menuId;

    // 어떤 식자재를 소진하려는 할인인지 (없을 수 있음)
    @Column(name = "ingredient_id")
    private Long ingredientId;

    @Column(name = "discount_pct", nullable = false)
    private Integer discountPct;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
