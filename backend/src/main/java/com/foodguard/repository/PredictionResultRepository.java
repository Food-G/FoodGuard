package com.foodguard.repository;

import com.foodguard.entity.PredictionResult;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PredictionResultRepository extends JpaRepository<PredictionResult, Long> {
    List<PredictionResult> findByStoreIdOrderByTargetDateDesc(Long storeId);
}
