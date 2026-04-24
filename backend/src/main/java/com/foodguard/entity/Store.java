package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "STORE")
@Getter @Setter
@NoArgsConstructor
public class Store {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "store_id")
    private Long id;

    @Column(name = "store_name", nullable = false, length = 100)
    private String storeName;

    // DB에 없는 필드지만 서비스에서 사용함
    @Transient
    private String address;
    @Transient
    private String phone;

    @Column(nullable = false, length = 100)
    private String region;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "opened_at", nullable = false)
    private java.time.LocalDate openedAt;

    // 서비스에서 setUser(user)를 호출하고 있으므로 연관관계 필요
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hq_user_id")
    private User user;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
