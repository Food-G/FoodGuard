package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "prediction")
@Getter @Setter @NoArgsConstructor
public class PredictionResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "prediction_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @Column(nullable = false)
    private LocalDateTime predictedAt;

    @Column(nullable = false)
    private LocalDate targetDate;

    @Column(nullable = false)
    private Integer predictedQuantity;

    private BigDecimal recommendedOrder;

    @Column(precision = 5, scale = 4)
    private BigDecimal accuracyScore;

    private String modelVersion;

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
