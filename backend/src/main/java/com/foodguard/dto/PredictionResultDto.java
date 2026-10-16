package com.foodguard.dto;

import com.foodguard.entity.PredictionResult;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
public class PredictionResultDto {

    private final Long id;
    private final Long menuId;
    private final String menuName;
    private final LocalDate predictionDate;
    private final Integer predictedQty;
    private final Integer recommendedOrderQty;
    private final BigDecimal confidence;
    private final String modelVersion;
    private final LocalDateTime createdAt;

    public PredictionResultDto(PredictionResult pr) {
        this.id = pr.getId();
        this.menuId = pr.getMenu().getId();
        this.menuName = pr.getMenu().getMenuName();
        this.predictionDate = pr.getPredictionDate();
        this.predictedQty = pr.getPredictedQty();
        this.recommendedOrderQty = pr.getRecommendedOrderQty();
        this.confidence = pr.getConfidence();
        this.modelVersion = pr.getModelVersion();
        this.createdAt = pr.getCreatedAt();
    }
}
