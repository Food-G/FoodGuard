package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PredictionResultService {

    private final PredictionResultRepository predictionResultRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;

    // 예측 결과 저장 (AI 서버 → 백엔드)
    @Transactional
    public PredictionResult create(Long storeId, Long menuId, LocalDate predictionDate,
                                   Integer predictedQty, BigDecimal confidence, String modelVersion) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        PredictionResult result = new PredictionResult();
        result.setStore(store);
        result.setMenu(menu);
        result.setPredictionDate(predictionDate);
        result.setPredictedQty(predictedQty);
        result.setConfidence(confidence);
        result.setModelVersion(modelVersion);
        return predictionResultRepository.save(result);
    }

    // 단건 조회
    public PredictionResult getById(Long id) {
        return predictionResultRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("예측 결과를 찾을 수 없습니다."));
    }

    // 가맹점별 전체 조회 (최신순)
    public List<PredictionResult> getByStore(Long storeId) {
        return predictionResultRepository.findByStoreIdOrderByPredictionDateDesc(storeId);
    }

    // 기간별 조회
    public List<PredictionResult> getByDateRange(Long storeId, LocalDate start, LocalDate end) {
        return predictionResultRepository
                .findByStoreIdAndPredictionDateBetweenOrderByPredictionDateDesc(storeId, start, end);
    }

    // 메뉴별 조회
    public List<PredictionResult> getByMenu(Long storeId, Long menuId) {
        return predictionResultRepository
                .findByStoreIdAndMenuIdOrderByPredictionDateDesc(storeId, menuId);
    }

    // 예측 결과 삭제
    @Transactional
    public String delete(Long id) {
        if (!predictionResultRepository.existsById(id)) {
            throw new RuntimeException("예측 결과를 찾을 수 없습니다.");
        }
        predictionResultRepository.deleteById(id);
        return "예측 결과 삭제 완료";
    }
}
