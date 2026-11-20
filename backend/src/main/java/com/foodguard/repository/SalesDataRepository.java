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

    @Query("SELECT s.store.id, COALESCE(SUM(s.quantity * COALESCE(s.unitPrice, m.price)), 0) FROM SalesData s JOIN s.menu m WHERE s.saleDate BETWEEN :start AND :end AND s.isDeleted = false GROUP BY s.store.id")
    List<Object[]> sumRevenueAllStoresBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    @Query("SELECT MAX(s.saleDate) FROM SalesData s WHERE s.store.id = :storeId AND s.isDeleted = false")
    LocalDate findLastSaleDate(@Param("storeId") Long storeId);

    @Query("SELECT MAX(s.saleDate) FROM SalesData s WHERE s.isDeleted = false")
    LocalDate findLastSaleDateAllStores();

    // [매장, 메뉴, 날짜, 판매량]
    @Query("SELECT s.store.id, s.menu.id, s.saleDate, SUM(s.quantity) FROM SalesData s WHERE s.isDeleted = false GROUP BY s.store.id, s.menu.id, s.saleDate")
    List<Object[]> sumQuantityByDay();

    // [할인 판매 수량, 할인 매출, 할인으로 깎인 금액]
    @Query("SELECT COALESCE(SUM(s.quantity), 0), COALESCE(SUM(s.quantity * s.unitPrice), 0), COALESCE(SUM(s.quantity * (m.price - s.unitPrice)), 0) FROM SalesData s JOIN s.menu m WHERE s.isDeleted = false AND s.discountPct > 0")
    List<Object[]> sumDiscountSales();

    // [매장, 할인 판매 수량] 기간 안
    @Query("SELECT s.store.id, SUM(s.quantity) FROM SalesData s WHERE s.saleDate BETWEEN :start AND :end AND s.isDeleted = false AND s.discountPct > 0 GROUP BY s.store.id")
    List<Object[]> sumDiscountQuantityBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    // [연, 월, 매출액] 전 가맹점 월별 매출
    @Query("SELECT YEAR(s.saleDate), MONTH(s.saleDate), COALESCE(SUM(s.quantity * COALESCE(s.unitPrice, m.price)), 0) FROM SalesData s JOIN s.menu m WHERE s.isDeleted = false GROUP BY YEAR(s.saleDate), MONTH(s.saleDate)")
    List<Object[]> sumRevenueByMonth();
}
