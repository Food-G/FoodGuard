package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

// 매장 예약. status: RESERVED(예약중) → VISITED(방문완료) 또는 CANCELLED(취소)
@Entity
@Table(name = "RESERVATION")
@Getter @Setter
@NoArgsConstructor
public class Reservation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "reservation_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(name = "customer_name", nullable = false, length = 50)
    private String customerName;

    @Column(length = 20)
    private String phone;

    @Column(name = "reservation_date", nullable = false)
    private LocalDate reservationDate;

    @Column(name = "reservation_time", nullable = false)
    private LocalTime reservationTime;

    @Column(nullable = false)
    private Integer guests;

    @Column(nullable = false, length = 20)
    private String status = "RESERVED";

    @Column(length = 200)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
