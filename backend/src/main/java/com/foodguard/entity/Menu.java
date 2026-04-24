package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;

@Entity
@Table(name = "MENU")
@Getter @Setter
@NoArgsConstructor
public class Menu {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @Column(name = "menu_name", nullable = false, length = 100)
    private String menuName;

    @Column(length = 50)
    private String category;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    // 서비스에서 사용하는 필드명 대응
    @Transient
    private Integer price;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;
    
    // setPrice 대응
    public void setPrice(Integer price) { this.price = price; }
    // setIsActive 대응 (Lombok은 isActive()와 setIsActive()를 생성하지만 boolean 필드명에 따라 달라질 수 있음)
    public void setIsActive(boolean isActive) { this.isActive = isActive; }
}
