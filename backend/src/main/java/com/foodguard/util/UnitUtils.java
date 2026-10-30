package com.foodguard.util;

public final class UnitUtils {

    private UnitUtils() {}

    public static double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }

    // 발주 단위 → 레시피 소단위 (프론트 Inventory.tsx toRecipeUnit 과 같은 규칙)
    public static String toRecipeUnit(String baseUnit) {
        if ("kg".equals(baseUnit)) return "g";
        if ("L".equals(baseUnit)) return "ml";
        return "개";
    }

    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
