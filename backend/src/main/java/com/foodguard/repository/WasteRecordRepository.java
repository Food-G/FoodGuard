package com.foodguard.repository;

import com.foodguard.entity.WasteRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface WasteRecordRepository extends JpaRepository<WasteRecord, Long> {
    List<WasteRecord> findByStoreIdOrderByWasteDateDesc(Long storeId);
    List<WasteRecord> findByStoreIdAndWasteDateBetweenOrderByWasteDateDesc(
            Long storeId, LocalDate start, LocalDate end);
    List<WasteRecord> findByStoreIdAndIngredientIdOrderByWasteDateDesc(Long storeId, Long ingredientId);
}
