package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// POS 테이블 배치와 좌석 수 (착석 인원·주문은 화면 상태로만 관리)
@Entity
@Table(name = "POS_TABLE")
@Getter @Setter
@NoArgsConstructor
public class PosTable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "table_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(nullable = false, length = 20)
    private String name;

    @Column(nullable = false)
    private Integer x;

    @Column(nullable = false)
    private Integer y;

    @Column(nullable = false)
    private Integer w;

    @Column(nullable = false)
    private Integer h;

    @Column(nullable = false)
    private Integer seats;
}
