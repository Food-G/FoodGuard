package com.foodguard.repository;

import com.foodguard.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StaffRepository extends JpaRepository<Staff, Long> {
    List<Staff> findByStoreIdOrderByIdAsc(Long storeId);
}
