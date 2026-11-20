package com.foodguard.util;

import java.util.Map;
import java.util.Set;

/**
 * 레시피 단위(g/ml/개) → 식자재 기준 단위(kg/L/개) 변환.
 *
 * 발주 추천(OrderRequestService)과 판매 시 재고 차감(SalesDataService)이
 * 반드시 같은 규칙을 써야 하므로 한 곳에 모아둔다.
 *
 * 호환되지 않는 조합(예: 기준 kg 에 레시피 ml)을 그대로 통과시키면
 * 재고·발주량이 조용히 1000배 어긋나므로, 저장 시점에 validate* 로 막고
 * 변환 시점에도 예외를 던진다.
 */
public final class UnitConverter {

    /** 기준 단위 → 허용되는 레시피 단위와 환산 계수(레시피 1단위 = 기준 몇 단위) */
    private static final Map<String, Map<String, Double>> RULES = Map.of(
            "kg", Map.of("g", 0.001, "kg", 1.0),
            "L", Map.of("ml", 0.001, "L", 1.0),
            "개", Map.of("개", 1.0)
    );

    public static final Set<String> BASE_UNITS = RULES.keySet();

    private UnitConverter() {
    }

    public static double toBaseUnit(double qty, String recipeUnit, String baseUnit) {
        return qty * factor(recipeUnit, baseUnit);
    }

    /** 식자재 기준 단위 검사. 'Kg', 'l' 같은 표기 흔들림은 표준형으로 바꿔 돌려준다. */
    public static String validateBaseUnit(String unit) {
        String u = normalize(unit);
        if (!RULES.containsKey(u)) {
            throw new IllegalStateException(
                    "식자재 단위는 " + BASE_UNITS + " 중 하나여야 합니다: " + unit);
        }
        return u;
    }

    /** 레시피 단위가 식자재 기준 단위와 호환되는지 검사하고 표준형을 돌려준다. */
    public static String validateRecipeUnit(String recipeUnit, String baseUnit) {
        String r = normalize(recipeUnit);
        factor(r, baseUnit);
        return r;
    }

    public static boolean isCompatible(String recipeUnit, String baseUnit) {
        Map<String, Double> allowed = RULES.get(normalize(baseUnit));
        return allowed != null && allowed.containsKey(normalize(recipeUnit));
    }

    private static double factor(String recipeUnit, String baseUnit) {
        Map<String, Double> allowed = RULES.get(normalize(baseUnit));
        Double f = allowed == null ? null : allowed.get(normalize(recipeUnit));
        if (f == null) {
            throw new IllegalStateException(
                    "레시피 단위 '" + recipeUnit + "'는 식자재 단위 '" + baseUnit + "'와 호환되지 않습니다"
                            + (allowed == null ? "" : " (허용: " + allowed.keySet() + ")"));
        }
        return f;
    }

    private static String normalize(String unit) {
        if (unit == null) return "";
        String u = unit.trim();
        if (u.equalsIgnoreCase("kg")) return "kg";
        if (u.equalsIgnoreCase("g")) return "g";
        if (u.equalsIgnoreCase("l")) return "L";
        if (u.equalsIgnoreCase("ml")) return "ml";
        return u;
    }
}
