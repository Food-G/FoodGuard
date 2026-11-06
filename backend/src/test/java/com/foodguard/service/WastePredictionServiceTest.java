package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** 폐기 예측 산식 (DB·Spring 컨텍스트 없음). */
class WastePredictionServiceTest {

    private static final LocalDate TODAY = LocalDate.now();
    private static final Long STORE = 60006L;

    private InventoryRepository invRepo;
    private InventoryLotRepository lotRepo;
    private PredictionResultRepository predRepo;
    private SalesDataRepository salesRepo;
    private MenuIngredientRepository recipeRepo;
    private WastePredictionService service;
    private Ingredient patty;
    private Menu menu;

    @BeforeEach
    void setUp() {
        invRepo = mock(InventoryRepository.class);
        lotRepo = mock(InventoryLotRepository.class);
        predRepo = mock(PredictionResultRepository.class);
        salesRepo = mock(SalesDataRepository.class);
        recipeRepo = mock(MenuIngredientRepository.class);
        service = new WastePredictionService(invRepo, lotRepo, predRepo, salesRepo, recipeRepo);
        patty = new Ingredient();
        patty.setId(1L);
        patty.setName("패티");
        patty.setUnit("kg");
        menu = new Menu();
        menu.setId(10L);
    }

    private static InventoryLot lot(double remaining, Integer daysLeft) {
        InventoryLot l = new InventoryLot();
        l.setIngredientId(1L);
        l.setRemainingQty(BigDecimal.valueOf(remaining));
        l.setExpiryDate(daysLeft != null ? TODAY.plusDays(daysLeft) : null);
        return l;
    }

    private static double[] flat(double perDay) {
        double[] d = new double[WastePredictionService.HORIZON_DAYS];
        java.util.Arrays.fill(d, perDay);
        return d;
    }

    private void stock(double qty, InventoryLot... lots) {
        Inventory inv = new Inventory();
        inv.setId(5L);
        inv.setIngredient(patty);
        inv.setQuantity(qty);
        inv.setUnit("kg");
        when(invRepo.findByStoreId(STORE)).thenReturn(List.of(inv));
        when(lotRepo.findOpenByStore(STORE)).thenReturn(List.of(lots));
    }

    /** 레시피 g → 식자재 kg, 오차범위 10% */
    private void recipe(double grams) {
        MenuIngredient mi = new MenuIngredient();
        mi.setIngredient(patty);
        mi.setQtyPerUnit(BigDecimal.valueOf(grams));
        mi.setUnit("g");
        mi.setTolerance(BigDecimal.TEN);
        when(recipeRepo.findByMenuId(10L)).thenReturn(List.of(mi));
    }

    private void predictAllDays(int qtyPerDay) {
        List<PredictionResult> rows = new java.util.ArrayList<>();
        for (int d = 0; d < WastePredictionService.HORIZON_DAYS; d++) {
            PredictionResult p = new PredictionResult();
            p.setMenu(menu);
            p.setPredictionDate(TODAY.plusDays(d));
            p.setPredictedQty(qtyPerDay);
            rows.add(p);
        }
        when(predRepo.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(STORE, TODAY))
                .thenReturn(rows);
    }

    @Test
    void fifoAssignsDemandToEarlierLotFirst() {
        // 하루 2kg: 2일 로트는 2일치(4kg)만 쓰이고 6kg 폐기, 5일 로트는 남은 3일치(6kg)로 다 쓰인다
        var a = WastePredictionService.assess(List.of(lot(10, 2), lot(6, 5)), flat(2), TODAY);
        assertEquals(6.0, a.wastePrediction(), 1e-9);
        assertEquals(10.0, a.expectedConsumption(), 1e-9);
        assertEquals(TODAY.plusDays(2), a.expiryDate());
    }

    @Test
    void laterLotCannotReuseDemandTakenByEarlierLot() {
        // 두 로트 모두 3일 기한, 3일 수요 6kg 를 합쳐 넘으면 초과분만 폐기
        var a = WastePredictionService.assess(List.of(lot(4, 3), lot(4, 3)), flat(2), TODAY);
        assertEquals(2.0, a.wastePrediction(), 1e-9);
        assertEquals(6.0, a.expectedConsumption(), 1e-9);
    }

    @Test
    void zeroDemandWastesEverythingWithinHorizon() {
        var a = WastePredictionService.assess(List.of(lot(3, 4)), flat(0), TODAY);
        assertEquals(3.0, a.wastePrediction(), 1e-9);
        assertEquals(0.0, a.expectedConsumption(), 1e-9);
    }

    @Test
    void expiredLotIsNeverConsumedAndAllWasted() {
        var a = WastePredictionService.assess(List.of(lot(3, -1), lot(2, 5)), flat(1), TODAY);
        assertEquals(3.0, a.expiredQty(), 1e-9);
        assertEquals(3.0, a.wastePrediction(), 1e-9);
        assertEquals(2.0, a.expectedConsumption(), 1e-9);
        assertEquals(TODAY.minusDays(1), a.expiryDate());
    }

    @Test
    void lotExpiringBeyondHorizonIsNotWaste() {
        // 장류처럼 180일 남은 재고는 7일 소모보다 많아도 이 기간의 폐기가 아니다
        var a = WastePredictionService.assess(List.of(lot(100, 180)), flat(1), TODAY);
        assertEquals(0.0, a.wastePrediction(), 1e-9);
        assertEquals(7.0, a.expectedConsumption(), 1e-9);
    }

    @Test
    void riskThresholds() {
        assertEquals("HIGH", WastePredictionService.riskLevel(2, 0.3));
        assertEquals("MEDIUM", WastePredictionService.riskLevel(3, 0.9));   // 기한 여유
        assertEquals("MEDIUM", WastePredictionService.riskLevel(1, 0.15));
        assertEquals("LOW", WastePredictionService.riskLevel(1, 0.14));
    }

    @Test
    void rowConvertsRecipeGramsToBaseKgWithToleranceAndUsesFrontendFields() {
        stock(10, lot(10, 2));
        recipe(100);          // 100g × 1.1 × 10개 = 1.1kg/일
        predictAllDays(10);

        Map<String, Object> row = service.predict(STORE).rows().get(0);

        assertEquals(5L, row.get("inventoryId"));
        assertEquals(1L, row.get("ingredientId"));
        assertEquals("패티", row.get("ingredientName"));
        assertEquals(10.0, row.get("currentQty"));
        assertEquals(TODAY.plusDays(2), row.get("expiryDate"));
        assertEquals(2L, row.get("daysUntilExpiry"));
        assertEquals(2.2, row.get("expectedConsumption"));
        assertEquals(7.8, row.get("wastePrediction"));
        assertEquals(78.0, row.get("wasteRate"));      // 화면은 퍼센트로 표시한다
        assertEquals("HIGH", row.get("riskLevel"));
        verifyNoInteractions(salesRepo);
    }

    @Test
    void lotsWithoutExpiryAreExcluded() {
        stock(5, lot(5, null));
        assertTrue(service.predict(STORE).rows().isEmpty());
    }

    @Test
    void fallsBackToRecentSalesAverageWithoutPredictions() {
        stock(10, lot(10, 2));
        recipe(1000);         // 1kg × 1.1 × 평균 1개 = 1.1kg/일
        SalesData sale = new SalesData();
        sale.setMenu(menu);
        sale.setQuantity(14);
        when(salesRepo.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(eq(STORE), any(), any()))
                .thenReturn(List.of(sale));

        var report = service.predict(STORE);

        assertEquals("fallback_avg", report.basis());
        assertEquals(2.2, report.rows().get(0).get("expectedConsumption"));
        assertTrue(report.warnings().isEmpty());
    }

    @Test
    void menuWithoutRecipeIsWarnedAndConsumesNothing() {
        stock(10, lot(10, 2));
        predictAllDays(10);
        when(recipeRepo.findByMenuId(10L)).thenReturn(List.of());

        var report = service.predict(STORE);

        assertEquals(10.0, report.rows().get(0).get("wastePrediction"));
        assertEquals("prediction", report.basis());
        assertEquals(1, report.warnings().size());
    }

    @Test
    void summaryCountsRisk() {
        stock(10, lot(10, 2));
        recipe(100);
        predictAllDays(10);

        Map<String, Object> s = service.summary(STORE);

        assertEquals(1, s.get("totalItems"));
        assertEquals(1L, s.get("highRisk"));
        assertEquals(7.8, s.get("expectedWasteKg"));
        assertTrue(s.containsKey("expectedWasteValue"));
        assertNull(s.get("expectedWasteValue"));
    }
}
