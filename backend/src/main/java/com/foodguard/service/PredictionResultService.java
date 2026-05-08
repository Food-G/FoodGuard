package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PredictionResultService {

    private final PredictionResultRepository predictionResultRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;

    public PredictionResult save(Long storeId, Long menuId, LocalDate targetDate,
                                 Integer predictedQuantity, BigDecimal recommendedOrder,
                                 BigDecimal accuracyScore, String modelVersion) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        PredictionResult result = new PredictionResult();
        result.setStore(store);
        result.setMenu(menu);
        result.setPredictedAt(LocalDateTime.now());
        result.setTargetDate(targetDate);
        result.setPredictedQuantity(predictedQuantity);
        result.setRecommendedOrder(recommendedOrder);
        result.setAccuracyScore(accuracyScore);
        result.setModelVersion(modelVersion);
        return predictionResultRepository.save(result);
    }

    public List<PredictionResult> getByStore(Long storeId) {
        return predictionResultRepository.findByStoreIdOrderByTargetDateDesc(storeId);
    }

    public String delete(Long id) {
        predictionResultRepository.deleteById(id);
        return "예측 결과 삭제 완료";
    }
}
