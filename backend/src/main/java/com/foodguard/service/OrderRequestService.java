package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OrderRequestService {

    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;

    // 발주 요청
    public OrderRequest create(Long storeId, Long ingredientId, Double quantity) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setIngredient(ingredient);
        order.setQuantity(quantity);
        order.setStatus("REQUESTED");
        order.setOrderedAt(LocalDateTime.now());
        return orderRequestRepository.save(order);
    }

    // 가맹점 발주 내역 조회
    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    // 발주 상태 변경
    public OrderRequest updateStatus(Long id, String status) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        order.setStatus(status);
        return orderRequestRepository.save(order);
    }

    // 발주 취소
    public String cancel(Long id) {
        OrderRequest order = orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
        if (!order.getStatus().equals("REQUESTED")) {
            return "승인된 발주는 취소할 수 없습니다.";
        }
        orderRequestRepository.deleteById(id);
        return "발주 취소 완료";
    }

    // ── AI 예측 기반 발주 추천 미리보기 ────────────────────────────────────
    @Transactional(readOnly = true)
    public List<Map<String, Object>> recommend(Long storeId) {
        LocalDate today = LocalDate.now();

        // 오늘 이후 예측 데이터 가져오기
        List<PredictionResult> predictions = predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today);

        if (predictions.isEmpty()) {
            return List.of();
        }

        // 메뉴별 7일 예측량 합산
        Map<Long, Integer> menuTotal = new LinkedHashMap<>();
        for (PredictionResult p : predictions) {
            menuTotal.merge(p.getMenu().getId(), p.getPredictedQty(), Integer::sum);
        }

        // 식자재별 총 필요량 계산 (레시피 소단위 → 발주 기준 단위로 변환)
        Map<Long, Double> required = new LinkedHashMap<>();
        Map<Long, String> ingName = new LinkedHashMap<>();
        Map<Long, String> ingUnit = new LinkedHashMap<>();

        for (Map.Entry<Long, Integer> entry : menuTotal.entrySet()) {
            for (MenuIngredient mi : menuIngredientRepository.findByMenuId(entry.getKey())) {
                Long ingId = mi.getIngredient().getId();
                String baseUnit = mi.getIngredient().getUnit(); // kg, L, 개
                String recipeUnit = mi.getUnit();               // g, ml, 개
                double rawQty = mi.getQtyPerUnit().doubleValue() * entry.getValue();
                double qty = convertToBaseUnit(rawQty, recipeUnit, baseUnit);
                required.merge(ingId, qty, Double::sum);
                ingName.putIfAbsent(ingId, mi.getIngredient().getName());
                ingUnit.putIfAbsent(ingId, baseUnit);
            }
        }

        // 현재 재고 맵
        Map<Long, Double> stock = new LinkedHashMap<>();
        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            stock.put(inv.getIngredient().getId(), inv.getCurrentQty().doubleValue());
        }

        // 발주 추천 목록 생성 (필요량 > 현재고인 식자재만)
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : required.entrySet()) {
            Long ingId = entry.getKey();
            double req = round1(entry.getValue());
            double cur = round1(stock.getOrDefault(ingId, 0.0));
            double orderQty = round1(Math.max(0, req - cur));
            if (orderQty <= 0) continue;

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ingredientId", ingId);
            item.put("ingredientName", ingName.get(ingId));
            item.put("unit", ingUnit.get(ingId));
            item.put("requiredQty", req);
            item.put("currentStock", cur);
            item.put("orderQty", orderQty);
            result.add(item);
        }

        return result;
    }

    // ── AI 예측 기반 발주 자동 등록 ────────────────────────────────────────
    @Transactional
    public List<OrderRequest> autoOrder(Long storeId) {
        List<Map<String, Object>> recs = recommend(storeId);
        List<OrderRequest> orders = new ArrayList<>();
        for (Map<String, Object> rec : recs) {
            Long ingId = ((Number) rec.get("ingredientId")).longValue();
            Double qty = ((Number) rec.get("orderQty")).doubleValue();
            orders.add(create(storeId, ingId, qty));
        }
        return orders;
    }

    // 레시피 소단위 → 발주 기준 단위 변환 (g→kg, ml→L)
    private double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
