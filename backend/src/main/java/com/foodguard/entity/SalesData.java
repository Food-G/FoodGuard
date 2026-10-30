package com.foodguard.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "SALES_DATA")
@Getter @Setter
@NoArgsConstructor
public class SalesData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sales_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "store_id", nullable = false)
    private Store store;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private Menu menu;

    @Column(name = "sales_date", nullable = false)
    private LocalDate saleDate;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
    
    public void setIsDeleted(boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    // menu 는 직렬화하지 않으므로 판매 내역 화면에 필요한 메뉴 정보만 내려준다
    @JsonProperty("menuId")
    public Long getMenuId() {
        return menu != null ? menu.getId() : null;
    }

    @JsonProperty("menuName")
    public String getMenuName() {
        return menu != null ? menu.getMenuName() : null;
    }

    @JsonProperty("menuPrice")
    public Integer getMenuPrice() {
        return menu != null ? menu.getPrice() : null;
    }
}
