package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

// 매장 직원(알바). pin 은 출퇴근 화면에서 직원을 구분하는 4자리 번호 (매장 안에서 중복 불가, 응답에 내보내지 않음)
@Entity
@Table(name = "EMPLOYEE")
@Getter @Setter
@NoArgsConstructor
public class Employee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "employee_id")
    private Long id;

    @Column(name = "store_id", nullable = false)
    private Long storeId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    @Column(name = "hourly_wage", nullable = false)
    private Integer hourlyWage;

    @JsonIgnore
    @Column(nullable = false, length = 4)
    private String pin;

    // 퇴사하면 false (출퇴근 기록은 남긴다)
    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
