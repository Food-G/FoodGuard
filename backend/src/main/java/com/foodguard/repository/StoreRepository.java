package com.foodguard.repository;

import com.foodguard.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreRepository extends JpaRepository<Store, Long> {
    List<Store> findByUserId(Long userId);
    List<Store> findByRegion(String region);
    List<Store> findByIsActiveTrue();
    long countByIsActiveTrue();
}
