package com.foodguard.repository;

import com.foodguard.entity.InventoryLot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InventoryLotRepository extends JpaRepository<InventoryLot, Long> {

    /** 남은 로트, FIFO 순 (유통기한 이른 것 → 유통기한 없는 것은 마지막, 같으면 먼저 입고된 것). */
    @Query("select l from InventoryLot l where l.storeId = :storeId and l.ingredientId = :ingredientId "
            + "and l.remainingQty > 0 order by case when l.expiryDate is null then 1 else 0 end, "
            + "l.expiryDate, l.receivedAt, l.id")
    List<InventoryLot> findOpenFifo(@Param("storeId") Long storeId, @Param("ingredientId") Long ingredientId);

    @Query("select l from InventoryLot l where l.storeId = :storeId and l.remainingQty > 0 "
            + "order by l.ingredientId, case when l.expiryDate is null then 1 else 0 end, l.expiryDate, l.receivedAt, l.id")
    List<InventoryLot> findOpenByStore(@Param("storeId") Long storeId);
}
