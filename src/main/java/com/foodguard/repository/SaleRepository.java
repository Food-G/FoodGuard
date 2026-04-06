package com.foodguard.repository;

import com.foodguard.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    // 가맹점별 매출 조회
    List<Sale> findByStoreId(String storeId);

    // 날짜별 매출 조회
    List<Sale> findBySaleDate(LocalDate saleDate);

    // 가맹점 + 날짜 범위로 매출 조회 (AI 예측에 나중에 쓸 거야)
    List<Sale> findByStoreIdAndSaleDateBetween(String storeId, LocalDate start, LocalDate end);
}