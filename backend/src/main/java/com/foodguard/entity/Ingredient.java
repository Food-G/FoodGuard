package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

// 지연 로딩 프록시로 응답에 실려도 JSON 변환이 실패하지 않게 한다
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    // 지연 로딩 프록시는 JSON 으로 만들 수 없다 (새 매장 식자재 조회·레시피·발주 내역이 400 으로 실패했음)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    // 아래 3개는 자동 발주 기간 계산용 (OrderRequestService.coverageDays). 비어 있으면 기본값
    // 입고 후 사용 가능 일수 (비어 있으면 제한 없음)
    @Column(name = "shelf_life_days")
    private Integer shelfLifeDays;

    // 발주 후 입고까지 일수 (다음날 입고 = 1)
    @Column(name = "lead_time_days")
    private Integer leadTimeDays;

    // 다음 입고까지 일수 (주 1회 입고 = 7)
    @Column(name = "order_cycle_days")
    private Integer orderCycleDays;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
