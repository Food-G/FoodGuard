package com.foodguard.util;

/**
 * 레시피 단위(g/ml/개) → 식자재 기준 단위(kg/L/개) 변환.
 *
 * 발주 추천(OrderRequestService)과 판매 시 재고 차감(SalesDataService)이
 * 반드시 같은 규칙을 써야 하므로 한 곳에 모아둔다.
 */
public final class UnitConverter {

    private UnitConverter() {
    }

    public static double toBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }
}
