package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "store")
@Getter @Setter @NoArgsConstructor
public class Store {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;                    // 점주 연결

    @Column(nullable = false)
    private String storeName;             // 가맹점 이름

    @Column(nullable = false)
    private String address;               // 주소

    private String phone;                 // 전화번호

    @Column(updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}