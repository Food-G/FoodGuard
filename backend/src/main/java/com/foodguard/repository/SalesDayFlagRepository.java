package com.foodguard.repository;

import com.foodguard.entity.SalesDayFlag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SalesDayFlagRepository extends JpaRepository<SalesDayFlag, Long> {
    List<SalesDayFlag> findByStoreIdOrderByFlagDateDesc(Long storeId);
    Optional<SalesDayFlag> findByStoreIdAndMenuIdAndFlagDateAndFlagType(Long storeId, Long menuId, LocalDate flagDate, String flagType);
}
