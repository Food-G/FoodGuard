package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SalesDataService {

    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final MenuRepository menuRepository;

    public SalesData create(Long storeId, Long menuId, Integer quantity, LocalDate saleDate) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));

        BigDecimal unitPrice = menu.getUnitPrice();
        BigDecimal totalAmount = unitPrice.multiply(BigDecimal.valueOf(quantity));

        SalesData sales = new SalesData();
        sales.setStore(store);
        sales.setMenu(menu);
        sales.setQuantity(quantity);
        sales.setUnitPrice(unitPrice);
        sales.setTotalAmount(totalAmount);
        sales.setSoldAt(saleDate.atStartOfDay());
        return salesDataRepository.save(sales);
    }

    public List<SalesData> getByStore(Long storeId) {
        return salesDataRepository.findByStoreId(storeId);
    }

    public List<SalesData> getByDateRange(Long storeId, LocalDate start, LocalDate end) {
        return salesDataRepository.findByStoreIdAndSoldAtBetween(
                storeId, start.atStartOfDay(), end.atTime(23, 59, 59));
    }

    public String delete(Long id) {
        salesDataRepository.deleteById(id);
        return "매출 데이터 삭제 완료";
    }
}
