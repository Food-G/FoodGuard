package com.foodguard.dto;

import com.foodguard.entity.SalesData;
import lombok.Getter;

import java.time.LocalDate;

@Getter
public class SaleResponse {

    private Long id;
    private String menuName;
    private Integer quantity;
    private LocalDate saleDate;
    private String storeName;

    public SaleResponse(SalesData salesData) {
        this.id = salesData.getId();
        this.menuName = salesData.getMenu().getMenuName();
        this.quantity = salesData.getQuantity();
        this.saleDate = salesData.getSaleDate();
        this.storeName = salesData.getStore().getStoreName();
    }
}