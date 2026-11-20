package com.foodguard.repository;

import com.foodguard.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByStoreIdAndReservationDateGreaterThanEqualOrderByReservationDateAscReservationTimeAsc(Long storeId, LocalDate from);
}
