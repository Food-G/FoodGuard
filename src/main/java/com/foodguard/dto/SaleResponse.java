package com.foodguard.dto;

import com.foodguard.entity.Sale;
import lombok.Getter;

import java.time.LocalDate;

@Getter
public class SaleResponse {

    private Long id;
    private String menuName;
    private Integer quantity;
    private Integer price;
    private LocalDate saleDate;
    private String storeId;

    // Entity → DTO 변환
    public SaleResponse(Sale sale) {
        this.id = sale.getId();
        this.menuName = sale.getMenuName();
        this.quantity = sale.getQuantity();
        this.price = sale.getPrice();
        this.saleDate = sale.getSaleDate();
        this.storeId = sale.getStoreId();
    }
}