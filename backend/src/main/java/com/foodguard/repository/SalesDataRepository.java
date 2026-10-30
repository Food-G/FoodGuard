package com.foodguard.repository;

import com.foodguard.entity.SalesData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface SalesDataRepository extends JpaRepository<SalesData, Long> {

    @Query("SELECT s FROM SalesData s JOIN FETCH s.menu WHERE s.store.id = :storeId AND s.isDeleted = false ORDER BY s.saleDate DESC")
    List<SalesData> findByStoreIdAndIsDeletedFalse(@Param("storeId") Long storeId);

    @Query("SELECT s FROM SalesData s JOIN FETCH s.menu WHERE s.store.id = :storeId AND s.saleDate BETWEEN :start AND :end AND s.isDeleted = false ORDER BY s.saleDate DESC")
    List<SalesData> findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(
            @Param("storeId") Long storeId,
            @Param("start") LocalDate start,
            @Param("end") LocalDate end);

    // 기간 내 가맹점별 매출 합계 (수량 × 메뉴 가격) — [storeId, 금액]
    @Query("SELECT s.store.id, SUM(s.quantity * s.menu.price) FROM SalesData s WHERE s.saleDate BETWEEN :start AND :end AND s.isDeleted = false GROUP BY s.store.id")
    List<Object[]> sumRevenueByStore(@Param("start") LocalDate start, @Param("end") LocalDate end);
}
