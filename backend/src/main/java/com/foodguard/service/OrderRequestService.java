package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.Store;
import java.util.stream.Collectors;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OrderRequestService {

    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;

    @Transactional
    public OrderRequest create(Long storeId, Long ingredientId, Double quantity) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setIngredient(ingredient);
        order.setOrderedQty(BigDecimal.valueOf(quantity));
        order.setStatus("REQUESTED");
        return orderRequestRepository.save(order);
    }

    public OrderRequest getById(Long id) {
        return orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
    }

    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    public List<OrderRequest> getByStatus(Long storeId, String status) {
        return orderRequestRepository.findByStoreIdAndStatus(storeId, status);
    }

    public List<OrderRequest> getAll() {
        return orderRequestRepository.findAll();
    }

    @Transactional
    public List<Inventory> initInventoryFromOrders(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));

        List<OrderRequest> orders = orderRequestRepository.findByStoreId(storeId).stream()
                .filter(o -> !o.getStatus().equals("CANCELLED"))
                .collect(Collectors.toList());

        Map<Long, Double> totalQty = new LinkedHashMap<>();
        Map<Long, Ingredient> ingredientMap = new LinkedHashMap<>();
        for (OrderRequest o : orders) {
            Long ingId = o.getIngredient().getId();
            totalQty.merge(ingId, o.getOrderedQty().doubleValue(), Double::sum);
            ingredientMap.putIfAbsent(ingId, o.getIngredient());
        }

        List<Inventory> result = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : totalQty.entrySet()) {
            Long ingId = entry.getKey();
            Ingredient ingredient = ingredientMap.get(ingId);
            double qty = round1(entry.getValue());

            Optional<Inventory> existing = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingId);
            Inventory inv = existing.orElse(new Inventory());
            double currentQty = existing.map(i -> i.getCurrentQty().doubleValue()).orElse(0.0);
            inv.setStore(store);
            inv.setIngredient(ingredient);
            inv.setCurrentQty(BigDecimal.valueOf(round1(currentQty + qty)));
            inv.setMinThreshold(inv.getMinThreshold() != null ? inv.getMinThreshold() : BigDecimal.ZERO);
            inv.setUnit(ingredient.getUnit());
            result.add(inventoryRepository.save(inv));
        }
        return result;
    }

    @Transactional
    public OrderRequest updateStatus(Long id, String status) {
        OrderRequest order = getById(id);
        String prev = order.getStatus();
        order.setStatus(status);

        if ("APPROVED".equals(status) && !"APPROVED".equals(prev)) {
            order.setApprovedAt(LocalDateTime.now());
            order.setDeliveryToken(UUID.randomUUID().toString().replace("-", ""));
        }

        if ("DONE".equals(status) && !"DONE".equals(prev)) {
            applyInventory(order);
        }

        return orderRequestRepository.save(order);
    }

    @Transactional
    public String cancel(Long id) {
        OrderRequest order = getById(id);
        if (!"REQUESTED".equals(order.getStatus())) {
            throw new RuntimeException("승인/처리된 발주는 취소할 수 없습니다. 현재 상태: " + order.getStatus());
        }
        order.setStatus("CANCELLED");
        orderRequestRepository.save(order);
        return "발주 취소 완료";
    }

    private void applyInventory(OrderRequest order) {
        Long storeId = order.getStore().getId();
        Long ingId = order.getIngredient().getId();
        double qty = order.getOrderedQty().doubleValue();

        Optional<Inventory> existing = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingId);
        Inventory inv = existing.orElse(new Inventory());
        double current = existing.map(i -> i.getCurrentQty().doubleValue()).orElse(0.0);
        inv.setStore(order.getStore());
        inv.setIngredient(order.getIngredient());
        inv.setCurrentQty(BigDecimal.valueOf(round1(current + qty)));
        inv.setMinThreshold(inv.getMinThreshold() != null ? inv.getMinThreshold() : BigDecimal.ZERO);
        inv.setUnit(order.getIngredient().getUnit());
        inventoryRepository.save(inv);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> recommend(Long storeId) {
        LocalDate today = LocalDate.now();

        List<PredictionResult> predictions = predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today);

        if (predictions.isEmpty()) {
            return List.of();
        }

        Map<Long, Integer> menuTotal = new LinkedHashMap<>();
        for (PredictionResult p : predictions) {
            menuTotal.merge(p.getMenu().getId(), p.getPredictedQty(), Integer::sum);
        }

        Map<Long, Double> required = new LinkedHashMap<>();
        Map<Long, String> ingName = new LinkedHashMap<>();
        Map<Long, String> ingUnit = new LinkedHashMap<>();

        for (Map.Entry<Long, Integer> entry : menuTotal.entrySet()) {
            for (MenuIngredient mi : menuIngredientRepository.findByMenuId(entry.getKey())) {
                Long ingId = mi.getIngredient().getId();
                String baseUnit = mi.getIngredient().getUnit();
                String recipeUnit = mi.getUnit();
                double rawQty = mi.getQtyPerUnit().doubleValue() * entry.getValue();
                double qty = convertToBaseUnit(rawQty, recipeUnit, baseUnit);
                required.merge(ingId, qty, Double::sum);
                ingName.putIfAbsent(ingId, mi.getIngredient().getName());
                ingUnit.putIfAbsent(ingId, baseUnit);
            }
        }

        Map<Long, Double> stock = new LinkedHashMap<>();
        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            stock.put(inv.getIngredient().getId(), inv.getCurrentQty().doubleValue());
        }

        Map<Long, Double> pending = new LinkedHashMap<>();
        for (OrderRequest o : orderRequestRepository.findByStoreIdAndStatusIn(storeId, List.of("REQUESTED", "APPROVED"))) {
            pending.merge(o.getIngredient().getId(), o.getOrderedQty().doubleValue(), Double::sum);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Long, Double> entry : required.entrySet()) {
            Long ingId = entry.getKey();
            double req = round1(entry.getValue());
            double cur = round1(stock.getOrDefault(ingId, 0.0));
            double alreadyOrdered = round1(pending.getOrDefault(ingId, 0.0));
            double orderQty = round1(Math.max(0, req - cur - alreadyOrdered));
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

    private double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
