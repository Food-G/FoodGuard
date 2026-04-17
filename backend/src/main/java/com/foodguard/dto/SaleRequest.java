package com.foodguard.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter @Setter
public class SaleRequest {

    private String menuName;
    private Integer quantity;
    private Integer price;
    private LocalDate saleDate;
    private String storeId;
}