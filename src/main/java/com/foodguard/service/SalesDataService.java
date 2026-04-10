package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;

    // 매출 등록
    public SalesData create(Long storeId, Long menuId,
                            Integer quantity, Integer totalPrice, LocalDate saleDate) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        SalesData sales = new SalesData();
        sales.setStore(store);
        sales.setMenu(menu);
        sales.setQuantity(quantity);
        sales.setTotalPrice(totalPrice);
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

    // Soft Delete (실제 삭제 X, 삭제 표시만)
    public String delete(Long id) {
        SalesData sales = salesDataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("매출 데이터를 찾을 수 없습니다."));
        sales.setIsDeleted(true);
        sales.setDeletedAt(LocalDateTime.now());
        salesDataRepository.save(sales);
        return "매출 데이터 삭제 완료";
    }
}