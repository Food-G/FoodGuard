package com.foodguard.service;

import com.foodguard.entity.Menu;
import com.foodguard.entity.Store;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MenuService {

    private final MenuRepository menuRepository;
    private final StoreRepository storeRepository;

    private static void validate(String menuName, Integer price) {
        if (menuName == null || menuName.isBlank()) throw new RuntimeException("메뉴 이름을 입력해 주세요.");
        if (price == null || price < 0) throw new RuntimeException("가격은 0원 이상이어야 합니다.");
    }

    // 메뉴 등록
    public Menu create(Long storeId, String menuName, Integer price, String category) {
        validate(menuName, price);
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Menu menu = new Menu();
        menu.setStore(store);
        menu.setMenuName(menuName);
        menu.setPrice(price);
        menu.setCategory(category);
        return menuRepository.save(menu);
    }

    // 가맹점 메뉴 조회 (활성 메뉴만)
    public List<Menu> getActiveMenus(Long storeId) {
        return menuRepository.findByStoreIdAndIsActiveTrue(storeId);
    }

    // 메뉴 수정
    public Menu update(Long menuId, String menuName, Integer price, String category) {
        validate(menuName, price);
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        menu.setMenuName(menuName);
        menu.setPrice(price);
        menu.setCategory(category);
        return menuRepository.save(menu);
    }

    // 메뉴 비활성화 (삭제 대신)
    public String deactivate(Long menuId) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        menu.setIsActive(false);
        menuRepository.save(menu);
        return "메뉴 비활성화 완료";
    }
}