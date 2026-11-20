package com.foodguard.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UnitConverterTest {

    @Test
    void 레시피_단위를_기준_단위로_환산한다() {
        assertEquals(0.25, UnitConverter.toBaseUnit(250, "g", "kg"), 1e-9);
        assertEquals(0.015, UnitConverter.toBaseUnit(15, "ml", "L"), 1e-9);
        assertEquals(2.0, UnitConverter.toBaseUnit(2, "개", "개"), 1e-9);
        assertEquals(1.5, UnitConverter.toBaseUnit(1.5, "kg", "kg"), 1e-9);
    }

    @Test
    void 표기_흔들림은_표준형으로_맞춘다() {
        assertEquals("kg", UnitConverter.validateBaseUnit("Kg"));
        assertEquals("L", UnitConverter.validateBaseUnit("l"));
        assertEquals("ml", UnitConverter.validateRecipeUnit("ML", "L"));
    }

    @Test
    void 호환되지_않는_조합은_예외() {
        // 예전에는 그대로 통과해 재고가 1000배 어긋났다
        assertThrows(IllegalStateException.class, () -> UnitConverter.toBaseUnit(250, "ml", "kg"));
        assertThrows(IllegalStateException.class, () -> UnitConverter.toBaseUnit(250, "g", "개"));
        assertThrows(IllegalStateException.class, () -> UnitConverter.validateRecipeUnit("개", "kg"));
        assertFalse(UnitConverter.isCompatible("g", "L"));
        assertTrue(UnitConverter.isCompatible("g", "kg"));
    }

    @Test
    void 기준_단위가_아니면_등록_거부() {
        assertThrows(IllegalStateException.class, () -> UnitConverter.validateBaseUnit("g"));
        assertThrows(IllegalStateException.class, () -> UnitConverter.validateBaseUnit("ml"));
        assertThrows(IllegalStateException.class, () -> UnitConverter.validateBaseUnit(null));
    }
}
