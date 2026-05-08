package com.foodguard.dto;

import com.foodguard.entity.SalesData;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
public class SaleResponse {

    private Long id;
    private String menuName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private LocalDateTime soldAt;
    private String storeName;

    public SaleResponse(SalesData salesData) {
        this.id = salesData.getId();
        this.menuName = salesData.getMenu().getMenuName();
        this.quantity = salesData.getQuantity();
        this.unitPrice = salesData.getUnitPrice();
        this.totalAmount = salesData.getTotalAmount();
        this.soldAt = salesData.getSoldAt();
        this.storeName = salesData.getStore().getStoreName();
    }
}
