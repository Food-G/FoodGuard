package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuRepository menuRepository;
    private final StoreRepository storeRepository;

    public Menu create(Long storeId, String menuName, BigDecimal unitPrice, String category) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = new Menu();
        menu.setStore(store);
        menu.setMenuName(menuName);
        menu.setUnitPrice(unitPrice);
        menu.setCategory(category);
        return menuRepository.save(menu);
    }

    public List<Menu> getActiveMenus(Long storeId) {
        return menuRepository.findByStoreIdAndIsActiveTrue(storeId);
    }

    public Menu update(Long menuId, String menuName, BigDecimal unitPrice, String category) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        menu.setMenuName(menuName);
        menu.setUnitPrice(unitPrice);
        menu.setCategory(category);
        return menuRepository.save(menu);
    }

    public String deactivate(Long menuId) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        menu.setIsActive(false);
        menuRepository.save(menu);
        return "메뉴 비활성화 완료";
    }
}
