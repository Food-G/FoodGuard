package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id")
    private Store store;

    @Column(nullable = false)
    private String type; // STOCK, WASTE, ORDER, ACCURACY

    @Column(name = "is_read", nullable = false)
    private boolean isRead = false;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    // DB 기본값이 없어(DEFAULT NULL) 앱이 넣어야 한다. 비어 있으면 24시간 중복 검사가 동작하지 않는다
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    public void setIsRead(boolean isRead) { this.isRead = isRead; }
}
