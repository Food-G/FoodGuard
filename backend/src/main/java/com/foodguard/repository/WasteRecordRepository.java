package com.foodguard.repository;

import com.foodguard.entity.WasteRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WasteRecordRepository extends JpaRepository<WasteRecord, Long> {
}
