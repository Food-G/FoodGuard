package com.foodguard.repository;

import com.foodguard.entity.PredictionResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface PredictionResultRepository extends JpaRepository<PredictionResult, Long> {

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId ORDER BY p.predictionDate DESC")
    List<PredictionResult> findByStore_IdOrderByPredictionDateDesc(@Param("storeId") Long storeId);

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId AND p.predictionDate >= :fromDate ORDER BY p.predictionDate ASC")
    List<PredictionResult> findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(
            @Param("storeId") Long storeId,
            @Param("fromDate") LocalDate fromDate);
}
