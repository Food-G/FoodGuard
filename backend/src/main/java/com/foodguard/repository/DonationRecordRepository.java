package com.foodguard.repository;

import com.foodguard.entity.DonationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DonationRecordRepository extends JpaRepository<DonationRecord, Long> {
    List<DonationRecord> findByStoreIdOrderByCreatedAtDesc(Long storeId);
    List<DonationRecord> findByStoreIdAndStatus(Long storeId, String status);
}
