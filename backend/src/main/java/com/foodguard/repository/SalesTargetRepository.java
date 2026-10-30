package com.foodguard.repository;

import com.foodguard.entity.SalesTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface SalesTargetRepository extends JpaRepository<SalesTarget, Long> {
    Optional<SalesTarget> findByStoreIdAndWeekStart(Long storeId, LocalDate weekStart);
}
