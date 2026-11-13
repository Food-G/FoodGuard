package com.foodguard.repository;

import com.foodguard.entity.EmployeeSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmployeeScheduleRepository extends JpaRepository<EmployeeSchedule, Long> {
    List<EmployeeSchedule> findByStoreIdOrderByWeekdayAscStartTimeAsc(Long storeId);
}
