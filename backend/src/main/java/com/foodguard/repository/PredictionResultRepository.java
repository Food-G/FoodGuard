package com.foodguard.repository;

import com.foodguard.entity.PredictionResult;
import org.springframework.data.jpa.repository.JpaRepository;
<<<<<<< HEAD
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
=======
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

import java.time.LocalDate;
import java.util.List;

public interface PredictionResultRepository extends JpaRepository<PredictionResult, Long> {
<<<<<<< HEAD

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId ORDER BY p.predictionDate DESC")
    List<PredictionResult> findByStore_IdOrderByPredictionDateDesc(@Param("storeId") Long storeId);

    @Query("SELECT p FROM PredictionResult p JOIN FETCH p.menu WHERE p.store.id = :storeId AND p.predictionDate >= :fromDate ORDER BY p.predictionDate ASC")
    List<PredictionResult> findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(
            @Param("storeId") Long storeId,
            @Param("fromDate") LocalDate fromDate);
=======
    List<PredictionResult> findByStoreIdOrderByPredictionDateDesc(Long storeId);
    List<PredictionResult> findByStoreIdAndPredictionDateBetweenOrderByPredictionDateDesc(
            Long storeId, LocalDate start, LocalDate end);
    List<PredictionResult> findByStoreIdAndMenuIdOrderByPredictionDateDesc(Long storeId, Long menuId);
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
}
