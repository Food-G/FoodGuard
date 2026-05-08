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
@Table(name = "NOTIFICATION")
@Getter @Setter
@NoArgsConstructor
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "password", "storeId"})
    private User user;

<<<<<<< HEAD
    @JsonIgnore
=======
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "user"})
    private Store store;

    @Column(nullable = false)
    private String type;

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public void setIsRead(boolean isRead) { this.isRead = isRead; }
}
