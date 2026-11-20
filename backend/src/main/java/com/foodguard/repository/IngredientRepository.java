package com.foodguard.repository;

import com.foodguard.entity.Ingredient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {
    // 이 매장 식자재 + 매장이 비어 있는 기존 식자재 중 이 매장 레시피·재고·발주에 실제로 쓰인 것.
    // 매장이 빈 식자재를 전부 넣으면 다른 매장이 등록한 식자재까지 보인다 (공유 DB 의 기존 29개가 전부 store_id NULL)
    @Query("""
            SELECT i FROM Ingredient i WHERE i.store.id = :storeId
               OR (i.store IS NULL AND (
                   EXISTS (SELECT 1 FROM MenuIngredient mi WHERE mi.ingredient = i AND mi.menu.store.id = :storeId)
                   OR EXISTS (SELECT 1 FROM Inventory v WHERE v.ingredient = i AND v.store.id = :storeId)
                   OR EXISTS (SELECT 1 FROM OrderRequest o WHERE o.ingredient = i AND o.store.id = :storeId)))
            """)
    List<Ingredient> findByStoreIdIncludingLegacy(@Param("storeId") Long storeId);
}