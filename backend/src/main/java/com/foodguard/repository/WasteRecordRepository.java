package com.foodguard.repository;

import com.foodguard.entity.WasteRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface WasteRecordRepository extends JpaRepository<WasteRecord, Long> {
    List<WasteRecord> findByStoreIdAndWasteDateBetweenOrderByWasteDateDescIdDesc(Long storeId, LocalDate from, LocalDate to);
}
