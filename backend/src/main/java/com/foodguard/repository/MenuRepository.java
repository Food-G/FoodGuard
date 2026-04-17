package com.foodguard.repository;

import com.foodguard.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MenuRepository extends JpaRepository<Menu, Long> {
    List<Menu> findByStoreId(Long storeId);
    List<Menu> findByStoreIdAndIsActiveTrue(Long storeId);
}