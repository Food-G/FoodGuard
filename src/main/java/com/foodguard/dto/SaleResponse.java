package com.foodguard.dto;

import com.foodguard.entity.SalesData;
import lombok.Getter;

import java.time.LocalDate;

@Getter
public class SaleResponse {

    private Long id;
    private String menuName;       // Menu Entity에서 꺼내옴
    private Integer quantity;
    private Integer totalPrice;
    private LocalDate saleDate;
    private String storeName;      // Store Entity에서 꺼내옴

    // SalesData Entity → DTO 변환
    public SaleResponse(SalesData salesData) {
        this.id = salesData.getId();
        this.menuName = salesData.getMenu().getMenuName();   // Menu Entity 연결
        this.quantity = salesData.getQuantity();
        this.totalPrice = salesData.getTotalPrice();
        this.saleDate = salesData.getSaleDate();
        this.storeName = salesData.getStore().getStoreName(); // Store Entity 연결
    }
}