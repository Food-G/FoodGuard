package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.*;
import com.foodguard.repository.PredictionResultRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 판매·폐기·기부가 재고·원장·로트에 맞게 반영되는지 HTTP 부터 DB 까지 확인한다 (D-2~D-4, AG-2, AG-3). */
class InventoryFlowTest extends IntegrationTest {

    @Autowired private PredictionResultRepository predictions;

    private User owner;
    private Store store;
    private Ingredient lettuce;

    @BeforeEach
    void setUp() {
        owner = user("OWNER");
        store = store(owner);
        lettuce = ingredient("kg", 5);
    }

    private double qty(Ingredient i) {
        return inventories.findByStoreIdAndIngredientId(store.getId(), i.getId()).orElseThrow().getCurrentQty().doubleValue();
    }

    private List<InventoryTxn> ledger(Ingredient i) {
        return txns.search(store.getId(), LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1), i.getId());
    }

    private List<InventoryLot> open(Ingredient i) {
        return lots.findOpenFifo(store.getId(), i.getId());
    }

    private void predictEveryDay(Menu m, int qtyPerDay) {
        for (int d = 0; d < 7; d++) {
            PredictionResult p = new PredictionResult();
            p.setStore(store);
            p.setMenu(m);
            p.setPredictionDate(LocalDate.now().plusDays(d));
            p.setPredictedQty(qtyPerDay);
            predictions.save(p);
        }
    }

    // ── 판매 (R2: 공용 DB 에서는 금지. 여기는 메모리 DB) ───────────────

    @Test
    void saleConvertsGramsToKgAndWritesOneLedgerRowPerIngredient() throws Exception {
        Ingredient onion = ingredient("kg", 14);
        stock(store, lettuce, 10);
        lot(store, lettuce, 10, 3);
        stock(store, onion, 10);
        lot(store, onion, 10, 3);
        Menu m = menu(store);
        recipe(m, lettuce, 100, "g");
        recipe(m, onion, 50, "g");

        postAs(owner, "/api/sales", Map.of("storeId", store.getId(), "menuId", m.getId(), "quantity", 10,
                "totalPrice", 100000, "saleDate", LocalDate.now().toString())).andExpect(status().isOk());

        assertEquals(9.0, qty(lettuce), 1e-9);      // 100g × 10 = 1kg (1000kg 가 아니다, R7)
        assertEquals(9.5, qty(onion), 1e-9);
        assertEquals("SALE", ledger(lettuce).get(0).getReason());
        assertEquals(-1.0, ledger(lettuce).get(0).getDeltaQty().doubleValue(), 1e-9);
        assertEquals(1, ledger(onion).size());
    }

    @Test
    void ledgerSumMatchesStockChangeAndLotsFollowFifo() throws Exception {
        stock(store, lettuce, 10);
        InventoryLot later = lot(store, lettuce, 7, 4);
        InventoryLot sooner = lot(store, lettuce, 3, 1);
        Menu m = menu(store);
        recipe(m, lettuce, 1000, "g");

        for (int i = 0; i < 2; i++) {
            postAs(owner, "/api/sales", Map.of("storeId", store.getId(), "menuId", m.getId(), "quantity", 2,
                    "totalPrice", 0, "saleDate", LocalDate.now().toString())).andExpect(status().isOk());
        }

        double delta = ledger(lettuce).stream().mapToDouble(t -> t.getDeltaQty().doubleValue()).sum();
        assertEquals(qty(lettuce) - 10.0, delta, 1e-9);
        assertEquals(6.0, qty(lettuce), 1e-9);
        // 기한 이른 로트(3)가 먼저 비고 나머지(1)는 늦은 로트에서 빠진다
        assertEquals(0.0, lots.findById(sooner.getId()).orElseThrow().getRemainingQty().doubleValue(), 1e-9);
        assertEquals(6.0, lots.findById(later.getId()).orElseThrow().getRemainingQty().doubleValue(), 1e-9);
    }

    // ── 폐기 (D-4) ───────────────────────────────────────────────────

    @Test
    void wasteLowersStockWritesLedgerAndCountsInRate() throws Exception {
        stock(store, lettuce, 10);
        lot(store, lettuce, 10, 3);
        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setIngredient(lettuce);
        order.setQuantity(10.0);
        order.setStatus("REQUESTED");
        order.setOrderedAt(LocalDateTime.now());
        order = orders.save(order);
        putAs(owner, "/api/orders/" + order.getId() + "/status", Map.of("status", "DONE")).andExpect(status().isOk());

        postAs(owner, "/api/waste/" + store.getId(), Map.of("ingredientId", lettuce.getId(), "quantity", 2.5, "reason", "DAMAGED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ingredientName").value(lettuce.getName()));

        assertEquals(17.5, qty(lettuce), 1e-9);
        getAs(owner, "/api/waste/" + store.getId()).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
        getAs(owner, "/api/waste/" + store.getId() + "/rate").andExpect(status().isOk())
                .andExpect(jsonPath("$[0].wasteQty").value(2.5))
                .andExpect(jsonPath("$[0].receivedQty").value(10.0))
                .andExpect(jsonPath("$[0].wasteRate").value(25.0));
    }

    @Test
    void wasteMoreThanStockIsRefused() throws Exception {
        stock(store, lettuce, 1);
        postAs(owner, "/api/waste/" + store.getId(), Map.of("ingredientId", lettuce.getId(), "quantity", 2, "reason", "OTHER"))
                .andExpect(status().isBadRequest());
        assertEquals(1.0, qty(lettuce), 1e-9);
    }

    // ── 폐기 예측 (AG-2) ─────────────────────────────────────────────

    @Test
    void wastePredictionUsesLotsAndPredictionsWithFrontendFields() throws Exception {
        stock(store, lettuce, 10);
        lot(store, lettuce, 10, 2);
        Menu m = menu(store);
        recipe(m, lettuce, 100, "g");
        predictEveryDay(m, 10);    // 100g × 10 = 1kg/일 → 2일 기한이면 2kg 소모, 8kg 폐기

        getAs(owner, "/api/waste-prediction/" + store.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].ingredientName").value(lettuce.getName()))
                .andExpect(jsonPath("$[0].expectedConsumption").value(2.0))
                .andExpect(jsonPath("$[0].wastePrediction").value(8.0))
                .andExpect(jsonPath("$[0].wasteRate").value(80.0))
                .andExpect(jsonPath("$[0].daysUntilExpiry").value(2))
                .andExpect(jsonPath("$[0].riskLevel").value("HIGH"))
                .andExpect(jsonPath("$[0].basis").value("prediction"));
        getAs(owner, "/api/waste-prediction/" + store.getId() + "/summary").andExpect(status().isOk())
                .andExpect(jsonPath("$.highRisk").value(1))
                .andExpect(jsonPath("$.expectedWasteKg").value(8.0));
    }

    @Test
    void wastePredictionWithoutForecastUsesRecentSales() throws Exception {
        stock(store, lettuce, 100);
        lot(store, lettuce, 100, 3);
        Menu m = menu(store);
        recipe(m, lettuce, 1000, "g");
        // 판매 등록은 재고를 줄이므로 먼저 등록한 뒤 값을 본다 (어제 14개 → 하루 평균 1개)
        postAs(owner, "/api/sales", Map.of("storeId", store.getId(), "menuId", m.getId(), "quantity", 14,
                "totalPrice", 0, "saleDate", LocalDate.now().minusDays(1).toString())).andExpect(status().isOk());

        getAs(owner, "/api/waste-prediction/" + store.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].basis").value("fallback_avg"))
                .andExpect(jsonPath("$[0].expectedConsumption").value(3.0));
    }

    // ── 기부 (AG-3) ──────────────────────────────────────────────────

    private Map<String, Object> donation(double quantity) {
        return Map.of("ingredientId", lettuce.getId(), "quantity", quantity, "donationType", "INGREDIENT",
                "orgName", "[예시] 가상 기관", "orgType", "FOOD_BANK");
    }

    @Test
    void donationDeductsStockOnlyWhenCompleted() throws Exception {
        stock(store, lettuce, 10);
        lot(store, lettuce, 10, 3);

        String body = postAs(owner, "/api/donations/" + store.getId(), donation(4))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PLANNED"))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(body).get("id").asLong();
        assertEquals(10.0, qty(lettuce), 1e-9);

        postAs(owner, "/api/donations/" + id + "/complete", Map.of())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        assertEquals(6.0, qty(lettuce), 1e-9);
        assertEquals("DONATION", ledger(lettuce).get(0).getReason());

        postAs(owner, "/api/donations/" + id + "/complete", Map.of()).andExpect(status().isBadRequest());
        assertEquals(6.0, qty(lettuce), 1e-9);
        getAs(owner, "/api/donations/store/" + store.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].orgName").value("[예시] 가상 기관"));
    }

    @Test
    void cannotDonateWhileExpiredStockRemains() throws Exception {
        stock(store, lettuce, 10);
        lot(store, lettuce, 2, -1);
        lot(store, lettuce, 8, 3);
        postAs(owner, "/api/donations/" + store.getId(), donation(1)).andExpect(status().isBadRequest());
    }

    @Test
    void cancelledDonationKeepsStock() throws Exception {
        stock(store, lettuce, 10);
        lot(store, lettuce, 10, 3);
        String body = postAs(owner, "/api/donations/" + store.getId(), donation(4)).andReturn().getResponse().getContentAsString();
        long id = json.readTree(body).get("id").asLong();
        postAs(owner, "/api/donations/" + id + "/cancel", Map.of()).andExpect(jsonPath("$.status").value("CANCELLED"));
        assertEquals(10.0, qty(lettuce), 1e-9);
    }

    @Test
    void openLotsAreFifoWithNullExpiryLast() {
        lot(store, lettuce, 1, null);
        lot(store, lettuce, 1, 5);
        lot(store, lettuce, 1, 2);
        List<InventoryLot> rows = open(lettuce);
        assertEquals(LocalDate.now().plusDays(2), rows.get(0).getExpiryDate());
        assertEquals(LocalDate.now().plusDays(5), rows.get(1).getExpiryDate());
        assertEquals(null, rows.get(2).getExpiryDate());
    }
}
