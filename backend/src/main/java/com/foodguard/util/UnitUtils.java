package com.foodguard.util;

public final class UnitUtils {

    private UnitUtils() {}

    public static double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }

    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
