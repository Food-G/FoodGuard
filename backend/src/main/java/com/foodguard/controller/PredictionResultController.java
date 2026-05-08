package com.foodguard.controller;

import com.foodguard.entity.PredictionResult;
import com.foodguard.service.PredictionResultService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/predictions")
@RequiredArgsConstructor
public class PredictionResultController {

    private final PredictionResultService predictionResultService;

    @PostMapping
    public PredictionResult create(
            @RequestParam Long storeId,
            @RequestParam Long menuId,
            @RequestParam String targetDate,
            @RequestParam Integer predictedQuantity,
            @RequestParam(required = false) BigDecimal recommendedOrder,
            @RequestParam(required = false) BigDecimal accuracyScore,
            @RequestParam(required = false) String modelVersion) {
        return predictionResultService.save(storeId, menuId, LocalDate.parse(targetDate),
                predictedQuantity, recommendedOrder, accuracyScore, modelVersion);
    }

    @GetMapping("/store/{storeId}")
    public List<PredictionResult> getByStore(@PathVariable Long storeId) {
        return predictionResultService.getByStore(storeId);
    }

    @DeleteMapping("/{id}")
    public String delete(@PathVariable Long id) {
        return predictionResultService.delete(id);
    }
}
