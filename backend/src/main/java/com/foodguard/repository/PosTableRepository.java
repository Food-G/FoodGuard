package com.foodguard.repository;

import com.foodguard.entity.PosTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PosTableRepository extends JpaRepository<PosTable, Long> {
    List<PosTable> findByStoreIdOrderByIdAsc(Long storeId);
    void deleteByStoreId(Long storeId);
}
