package com.foodguard.entity;

<<<<<<< HEAD
import com.fasterxml.jackson.annotation.JsonIgnore;
=======
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
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
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "storeId"})
    private User user;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
}
