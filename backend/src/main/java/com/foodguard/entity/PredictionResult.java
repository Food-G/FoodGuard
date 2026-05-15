package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "PREDICTION_RESULT")
@Getter @Setter
@NoArgsConstructor
public class PredictionResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "prediction_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @Column(name = "target_date", nullable = false)
    private LocalDate predictionDate; // targetDate에서 복구

    @Column(name = "predicted_qty", nullable = false)
    private Integer predictedQty;

    @Column(precision = 5, scale = 2)
    private BigDecimal confidence;

    @Column(name = "model_version", length = 50)
    private String modelVersion;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
