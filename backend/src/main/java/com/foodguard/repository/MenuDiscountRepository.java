package com.foodguard.repository;

import com.foodguard.entity.MenuDiscount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface MenuDiscountRepository extends JpaRepository<MenuDiscount, Long> {

    @Query("SELECT d FROM MenuDiscount d WHERE d.storeId = :storeId AND d.active = true AND d.startDate <= :day AND d.endDate >= :day")
    List<MenuDiscount> findActiveOn(@Param("storeId") Long storeId, @Param("day") LocalDate day);

    List<MenuDiscount> findByStoreIdAndMenuIdAndActiveTrue(Long storeId, Long menuId);
}
