package com.foodguard.repository;

import com.foodguard.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    List<Employee> findByStoreIdOrderByActiveDescNameAsc(Long storeId);
    Optional<Employee> findByStoreIdAndPinAndActiveTrue(Long storeId, String pin);
    boolean existsByStoreIdAndPinAndActiveTrue(Long storeId, String pin);
}
