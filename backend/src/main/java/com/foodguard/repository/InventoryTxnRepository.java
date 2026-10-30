package com.foodguard.repository;

import com.foodguard.entity.InventoryTxn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface InventoryTxnRepository extends JpaRepository<InventoryTxn, Long> {

    @Query("select t from InventoryTxn t where t.storeId = :storeId and t.createdAt >= :from and t.createdAt < :to "
            + "and (:ingredientId is null or t.ingredientId = :ingredientId) order by t.createdAt desc, t.id desc limit 500")
    List<InventoryTxn> search(@Param("storeId") Long storeId, @Param("from") LocalDateTime from,
                              @Param("to") LocalDateTime to, @Param("ingredientId") Long ingredientId);
}
