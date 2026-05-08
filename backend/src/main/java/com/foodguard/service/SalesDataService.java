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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;
    private final InventoryService inventoryService;

    // 매출 등록 + 재고 자동 차감
    @Transactional
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
        SalesData saved = salesDataRepository.save(sales);

        // 메뉴-재료 매핑이 등록된 경우 자동 재고 차감
        try {
            inventoryService.deductByMenuSale(storeId, menuId, quantity);
        } catch (Exception ignored) {
            // 레시피 미등록 시 차감 생략 (매출 기록은 유지)
        }

        return saved;
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

    // 매출 수정
    @Transactional
    public SalesData update(Long id, Integer quantity, Integer totalPrice, LocalDate saleDate) {
        SalesData sales = salesDataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("매출 데이터를 찾을 수 없습니다."));
        if (sales.isDeleted()) {
            throw new RuntimeException("삭제된 매출 데이터는 수정할 수 없습니다.");
        }
        if (quantity != null) sales.setQuantity(quantity);
        if (totalPrice != null) sales.setTotalPrice(totalPrice);
        if (saleDate != null) sales.setSaleDate(saleDate);
        return salesDataRepository.save(sales);
    }

    // Soft Delete
    @Transactional    public String delete(Long id) {
        SalesData sales = salesDataRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("매출 데이터를 찾을 수 없습니다."));
        sales.setIsDeleted(true);
        sales.setDeletedAt(LocalDateTime.now());
        salesDataRepository.save(sales);
        return "매출 데이터 삭제 완료";
    }
}
