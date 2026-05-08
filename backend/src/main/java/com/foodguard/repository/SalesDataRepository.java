package com.foodguard.repository;

import com.foodguard.entity.SalesData;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface SalesDataRepository extends JpaRepository<SalesData, Long> {
    List<SalesData> findByStoreId(Long storeId);
    List<SalesData> findByStoreIdAndSoldAtBetween(Long storeId, LocalDateTime start, LocalDateTime end);
}
