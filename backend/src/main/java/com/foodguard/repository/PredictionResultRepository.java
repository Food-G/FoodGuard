package com.foodguard.repository;

import com.foodguard.entity.PredictionResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface PredictionResultRepository extends JpaRepository<PredictionResult, Long> {

    // [매장, 메뉴, 날짜, 예측량] 이미 지난 날짜의 예측 (재예측은 오늘 이후만 지우므로 그날 전 마지막 예측이 남아 있다)
    // 현재 글로벌 모델만 잰다. 예전 모델(rf_*, 2026-05~06 오차율 약 70%)의 기록이 지금 모델의 성적으로 보이면 안 된다
    @Query("SELECT p.store.id, p.menu.id, p.predictionDate, p.predictedQty FROM PredictionResult p WHERE p.predictionDate < :today AND p.modelVersion LIKE 'xgb_global%'")
    List<Object[]> findPastPredictions(@Param("today") LocalDate today);

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId ORDER BY p.predictionDate DESC")
    List<PredictionResult> findByStore_IdOrderByPredictionDateDesc(@Param("storeId") Long storeId);

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId AND p.predictionDate >= :fromDate ORDER BY p.predictionDate ASC")
    List<PredictionResult> findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(
            @Param("storeId") Long storeId,
            @Param("fromDate") LocalDate fromDate);
}
