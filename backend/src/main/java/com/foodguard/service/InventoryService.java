package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
        inventory.setCurrentQty(BigDecimal.valueOf(quantity));
        inventory.setMinThreshold(BigDecimal.valueOf(minThreshold != null ? minThreshold : quantity * 0.2));
        inventory.setUnit(unit != null ? unit : ingredient.getUnit());        return inventoryRepository.save(inventory);
    }

    // 가맹점 재고 조회
    public List<Inventory> getByStore(Long storeId) {
        return inventoryRepository.findByStoreId(storeId);
    }

    // 재고 부족 항목 조회 (currentQty < minThreshold)
    public List<Inventory> getLowStock(Long storeId) {
        return inventoryRepository.findLowStockByStoreId(storeId);
    }

    // 재고 수량 수정
    @Transactional
    public Inventory update(Long id, Double quantity) {
        Inventory inventory = inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("재고를 찾을 수 없습니다."));
        inventory.setCurrentQty(BigDecimal.valueOf(quantity));
        return inventoryRepository.save(inventory);
    }

    // 최소 임계값 수정
    @Transactional
    public Inventory updateThreshold(Long id, Double minThreshold) {
        Inventory inventory = inventoryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("재고를 찾을 수 없습니다."));
        inventory.setMinThreshold(BigDecimal.valueOf(minThreshold));
        return inventoryRepository.save(inventory);
    }

    // 판매 시 자동 재고 차감 (MenuIngredient 기반)
    @Transactional
    public void deductByMenuSale(Long storeId, Long menuId, Integer saleQuantity) {
        List<MenuIngredient> menuIngredients = menuIngredientRepository.findByMenuId(menuId);
        if (menuIngredients.isEmpty()) return;

        for (MenuIngredient mi : menuIngredients) {
            BigDecimal deductAmount = mi.getQtyPerUnit()
                    .multiply(BigDecimal.valueOf(saleQuantity));

            inventoryRepository.findByStoreIdAndIngredientId(storeId, mi.getIngredient().getId())
                    .ifPresent(inventory -> {
                        BigDecimal newQty = inventory.getCurrentQty().subtract(deductAmount);
                        if (newQty.compareTo(BigDecimal.ZERO) < 0) {
                            newQty = BigDecimal.ZERO;
                        }
                        inventory.setCurrentQty(newQty);
                        inventoryRepository.save(inventory);

                        // 재고 부족 시 알림 자동 생성
                        if (newQty.compareTo(inventory.getMinThreshold()) < 0) {
                            notificationService.createStockAlert(
                                    storeId,
                                    mi.getIngredient().getName(),
                                    newQty.doubleValue(),
                                    inventory.getUnit()
                            );
                        }
                    });
        }
    }

    // 간편 재고 등록
    // ★ 같은 매장+재료 재고가 이미 있으면 수량을 더해주고(입고 처리), 없으면 신규 생성
    @Transactional
    public Inventory register(Long storeId, String ingredientName, Double quantity,
                              BigDecimal price, LocalDate expiryDate, String unit) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));

        String resolvedUnit = (unit != null && !unit.isBlank()) ? unit : "개";

        // 동일 이름 식자재 조회 or 신규 생성
        Ingredient ingredient = ingredientRepository.findByName(ingredientName)
                .orElseGet(() -> {
                    Ingredient ing = new Ingredient();
                    ing.setName(ingredientName);
                    ing.setUnit(resolvedUnit);
                    ing.setCategory("기타");
                    return ingredientRepository.save(ing);
                });

        // ★ 이 매장에 같은 재료 재고가 이미 존재하면 → 수량 추가 (입고), 중복 생성 방지
        return inventoryRepository.findByStoreIdAndIngredientId(storeId, ingredient.getId())
                .map(existing -> {
                    existing.setCurrentQty(existing.getCurrentQty().add(BigDecimal.valueOf(quantity)));
                    if (price != null && price.compareTo(BigDecimal.ZERO) > 0) {
                        existing.setPrice(price);
                    }
                    if (expiryDate != null) {
                        existing.setExpiryDate(expiryDate);
                    }
                    existing.setRegisteredAt(LocalDateTime.now());
                    return inventoryRepository.save(existing);
                })
                .orElseGet(() -> {
                    // 없으면 신규 생성
                    Inventory inventory = new Inventory();
                    inventory.setStore(store);
                    inventory.setIngredient(ingredient);
                    inventory.setCurrentQty(BigDecimal.valueOf(quantity));
                    inventory.setMinThreshold(BigDecimal.valueOf(Math.max(1, quantity * 0.1)));
                    inventory.setUnit(resolvedUnit);
                    inventory.setPrice(price);
                    inventory.setExpiryDate(expiryDate);
                    inventory.setRegisteredAt(LocalDateTime.now());
                    return inventoryRepository.save(inventory);
                });
    }

    // 재고 삭제
    @Transactional
    public String delete(Long id) {
        if (!inventoryRepository.existsById(id)) {
            throw new RuntimeException("재고를 찾을 수 없습니다.");
        }
        inventoryRepository.deleteById(id);
        return "재고 삭제 완료";
    }
}