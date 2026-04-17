package com.foodguard.repository;

import com.foodguard.entity.SalesData;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface SalesDataRepository extends JpaRepository<SalesData, Long> {
    List<SalesData> findByStoreIdAndIsDeletedFalse(Long storeId);
    List<SalesData> findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(
            Long storeId, LocalDate start, LocalDate end);
}