package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "prediction_result")
@Getter @Setter @NoArgsConstructor
public class PredictionResult {

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
    private Integer predictedQty;        // AI 예측 판매량

    @Column(nullable = false)
    private LocalDate predictionDate;    // 예측 날짜

    private LocalDateTime createdAt = LocalDateTime.now();
}