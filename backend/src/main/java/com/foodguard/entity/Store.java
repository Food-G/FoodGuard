package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

// 지연 로딩 프록시로 응답에 실려도 JSON 변환이 실패하지 않게 한다
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
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

    @Column(length = 255)
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(nullable = false, length = 100)
    private String region;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(name = "opened_at", nullable = false)
    private java.time.LocalDate openedAt;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hq_user_id")
    private User user;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
