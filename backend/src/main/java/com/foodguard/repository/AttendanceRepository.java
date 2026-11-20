package com.foodguard.repository;

import com.foodguard.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByStoreIdAndClockInBetweenOrderByClockInAsc(Long storeId, LocalDateTime start, LocalDateTime end);
    Optional<Attendance> findFirstByEmployeeIdAndClockOutIsNullOrderByClockInDesc(Long employeeId);
}
