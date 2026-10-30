package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;

    // 매출 등록
    @Transactional
    public SalesData create(Long storeId, Long menuId, Integer quantity, LocalDate saleDate) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        SalesData sales = new SalesData();
        sales.setStore(store);
        sales.setMenu(menu);
        sales.setQuantity(quantity);
        sales.setSaleDate(saleDate);
        return salesDataRepository.save(sales);
    }

    // 가맹점 매출 조회 (삭제 안 된 것만)
    public List<SalesData> getByStore(Long storeId) {
        return salesDataRepository.findByStoreIdAndIsDeletedFalse(storeId);
    }

    // 기간별 매출 조회
    public List<SalesData> getByDateRange(Long storeId, LocalDate start, LocalDate end) {
        return salesDataRepository
                .findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, start, end);
    }

    // 전 가맹점 최근 7일 매출 {storeId: 매출액} (본사 대시보드)
    public Map<Long, Long> getAllStoreWeeklySummary() {
        LocalDate today = LocalDate.now();
        Map<Long, Long> result = new LinkedHashMap<>();
        for (Object[] row : salesDataRepository.sumRevenueAllStoresBetween(today.minusDays(6), today)) {
            result.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return result;
    }
}