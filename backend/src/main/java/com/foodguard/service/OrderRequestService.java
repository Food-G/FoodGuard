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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderRequestService {

    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final InventoryRepository inventoryRepository;

    // 발주 요청 생성
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
        order.setOrderedAt(LocalDateTime.now());
        return orderRequestRepository.save(order);
    }

    // 단건 조회
    public OrderRequest getById(Long id) {
        return orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
    }

    // 가맹점 발주 내역 조회
    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    // 전체 발주 조회 (본사용)
    public List<OrderRequest> getAll() {
        return orderRequestRepository.findAll();
    }

    // 발주 상태 변경 — DONE 전환 시 재고 자동 반영
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

    // 발주 취소 (REQUESTED 상태만 가능)
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

    // 발주 완료 시 재고 자동 반영
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

    // AI 예측 기반 발주 추천 미리보기
    @Transactional(readOnly = true)
    public List<Map<String, Object>> recommend(Long storeId) {
        LocalDate today = LocalDate.now();

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
                String baseUnit = mi.getIngredient().getUnit();
                String recipeUnit = mi.getUnit();
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

        // 진행 중인 발주량 (중복 방지)
        Map<Long, Double> pending = new LinkedHashMap<>();
        for (OrderRequest o : orderRequestRepository.findByStoreIdAndStatusIn(storeId, List.of("REQUESTED", "APPROVED"))) {
            pending.merge(o.getIngredient().getId(), o.getOrderedQty().doubleValue(), Double::sum);
        }

        // 발주 필요한 식자재만 반환
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

    // ── 3단계 검수 흐름 ─────────────────────────────────────────────────────────

    // 1단계: 본사 발송 검수 완료 (APPROVED → HQ_SENT) + 배달기사 그룹 토큰 생성
    @Transactional
    public OrderRequest hqSend(Long id) {
        OrderRequest order = getById(id);
        if (!"APPROVED".equals(order.getStatus())) {
            throw new RuntimeException("승인된 발주만 발송 처리할 수 있습니다.");
        }
        order.setStatus("HQ_SENT");
        order.setHqSentAt(LocalDateTime.now());
        if (order.getDeliveryGroupToken() == null) {
            order.setDeliveryGroupToken(UUID.randomUUID().toString().replace("-", ""));
        }
        return orderRequestRepository.save(order);
    }

    // 2단계: 배달기사 수령 확인 (HQ_SENT → DRIVER_RECEIVED)
    @Transactional
    public OrderRequest driverReceive(Long id) {
        OrderRequest order = getById(id);
        if (!"HQ_SENT".equals(order.getStatus())) {
            throw new RuntimeException("발송 처리된 발주만 수령 확인할 수 있습니다.");
        }
        order.setStatus("DRIVER_RECEIVED");
        order.setDriverReceivedAt(LocalDateTime.now());
        return orderRequestRepository.save(order);
    }

    // 3단계: 가맹점주 수령 확인 (DRIVER_RECEIVED → DONE + 재고 자동 반영)
    @Transactional
    public OrderRequest ownerReceive(Long id) {
        OrderRequest order = getById(id);
        if (!"DRIVER_RECEIVED".equals(order.getStatus())) {
            throw new RuntimeException("배달기사가 수령 확인한 발주만 처리할 수 있습니다.");
        }
        order.setStatus("DONE");
        order.setOwnerReceivedAt(LocalDateTime.now());
        orderRequestRepository.save(order);
        applyInventory(order);
        return order;
    }

    // 2단계 그룹: 배달기사 수령 확인 (HQ_SENT → DRIVER_RECEIVED)
    @Transactional
    public void driverReceiveGroup(String groupToken) {
        List<OrderRequest> orders = orderRequestRepository.findByDeliveryGroupToken(groupToken);
        for (OrderRequest o : orders) {
            if ("HQ_SENT".equals(o.getStatus())) {
                o.setStatus("DRIVER_RECEIVED");
                o.setDriverReceivedAt(LocalDateTime.now());
                orderRequestRepository.save(o);
            }
        }
    }

    // 그룹 배송 시작 — APPROVED → IN_DELIVERY
    @Transactional
    public void startGroupDelivery(String groupToken) {
        List<OrderRequest> orders = orderRequestRepository.findByDeliveryGroupToken(groupToken);
        for (OrderRequest o : orders) {
            if ("APPROVED".equals(o.getStatus())) {
                o.setStatus("IN_DELIVERY");
                orderRequestRepository.save(o);
            }
        }
    }

    // 그룹 배달 완료 (기사 측) — IN_DELIVERY → DELIVERED
    @Transactional
    public void completeGroupDelivery(String groupToken) {
        List<OrderRequest> orders = orderRequestRepository.findByDeliveryGroupToken(groupToken);
        for (OrderRequest o : orders) {
            if ("IN_DELIVERY".equals(o.getStatus())) {
                o.setStatus("DELIVERED");
                orderRequestRepository.save(o);
            }
        }
    }

    // 검수 확인 (가맹점주) — DELIVERED → DONE + 재고 자동 반영
    @Transactional
    public void inspectGroupDelivery(String groupToken) {
        List<OrderRequest> orders = orderRequestRepository.findByDeliveryGroupToken(groupToken);
        for (OrderRequest o : orders) {
            if ("DELIVERED".equals(o.getStatus())) {
                o.setStatus("DONE");
                orderRequestRepository.save(o);
                applyInventory(o);
            }
        }
    }

    // AI 기반 자동 발주 등록
    @Transactional
    public List<OrderRequest> autoOrder(Long storeId) {
        boolean hasPredictions = !predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, LocalDate.now())
                .isEmpty();
        if (!hasPredictions) {
            throw new RuntimeException("AI 예측 데이터가 없습니다. 예측 페이지에서 먼저 예측을 실행해주세요.");
        }
        List<Map<String, Object>> recs = recommend(storeId);
        List<OrderRequest> orders = new ArrayList<>();
        for (Map<String, Object> rec : recs) {
            Long ingId = ((Number) rec.get("ingredientId")).longValue();
            Double qty = ((Number) rec.get("orderQty")).doubleValue();
            orders.add(create(storeId, ingId, qty));
        }
        return orders;
    }

    // 발주량 → 재고 초기화 (승인되지 않은 발주 기반)
    @Transactional
    public List<Inventory> initInventoryFromOrders(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));

        List<OrderRequest> orders = orderRequestRepository.findByStoreIdAndStatusIn(
                storeId, List.of("REQUESTED", "APPROVED"));

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

    private double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        if ("g".equals(recipeUnit) && "kg".equals(baseUnit)) return qty / 1000.0;
        if ("ml".equals(recipeUnit) && "L".equals(baseUnit)) return qty / 1000.0;
        return qty;
    }

    private double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
