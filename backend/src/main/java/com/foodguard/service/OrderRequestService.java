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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodguard.util.UnitUtils;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
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
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;

    // 발주 요청 생성 (점주 직접 입력) — 그 시점의 AI 추천량을 함께 남긴다
    @Transactional
    public OrderRequest create(Long storeId, Long ingredientId, Double quantity) {
        return create(storeId, ingredientId, quantity, null, "MANUAL");
    }

    // recommendedQty 가 null 이면 현재 추천 목록에서 찾는다 (추천에 없던 식자재는 0)
    private OrderRequest create(Long storeId, Long ingredientId, Double quantity,
                                Double recommendedQty, String orderSource) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        // 매장·식자재를 먼저 읽은 뒤 recommend()를 불러야 한다. 순서가 바뀌면 store가 지연로딩 프록시로 잡혀
        // 응답 JSON 직렬화가 실패한다 (ByteBuddyInterceptor)
        if (recommendedQty == null) {
            recommendedQty = recommend(storeId).stream()
                    .filter(r -> ((Number) r.get("ingredientId")).longValue() == ingredientId)
                    .mapToDouble(r -> ((Number) r.get("orderQty")).doubleValue())
                    .findFirst()
                    .orElse(0.0);
        }

        OrderRequest order = new OrderRequest();
        order.setStore(store);
        order.setIngredient(ingredient);
        order.setOrderedQty(BigDecimal.valueOf(quantity));
        order.setStatus("REQUESTED");
        order.setOrderedAt(LocalDateTime.now());
        order.setRecommendedQty(BigDecimal.valueOf(recommendedQty));
        order.setOrderSource(orderSource);
        return orderRequestRepository.save(order);
    }

    // 단건 조회
    @Transactional(readOnly = true)
    public OrderRequest getById(Long id) {
        return orderRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("발주 요청을 찾을 수 없습니다."));
    }

    // 가맹점 발주 내역 조회
    @Transactional(readOnly = true)
    public List<OrderRequest> getByStore(Long storeId) {
        return orderRequestRepository.findByStoreId(storeId);
    }

    // 전체 발주 조회 (본사용)
    @Transactional(readOnly = true)
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
            notificationService.create(order.getStore().getId(),
                String.format("발주 승인: %s %s%s 승인되었습니다.", order.getIngredient().getName(),
                    order.getOrderedQty().toPlainString(), order.getIngredient().getUnit()),
                "ORDER");
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

    // 발주 완료 시 재고 자동 반영 (유통기한도 전파)
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
        inv.setUnit(order.getIngredient().getUnit());
        if (order.getExpiryDate() != null) {
            if (inv.getExpiryDate() == null || order.getExpiryDate().isBefore(inv.getExpiryDate())) {
                inv.setExpiryDate(order.getExpiryDate());
            }
        }
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

        // 메뉴별 날짜별 예측
        Map<Long, List<PredictionResult>> menuPredictions = new LinkedHashMap<>();
        for (PredictionResult p : predictions) {
            menuPredictions.computeIfAbsent(p.getMenu().getId(), k -> new ArrayList<>()).add(p);
        }

        // 식자재별 총 필요량 계산 (레시피 소단위 → 발주 기준 단위로 변환)
        // 식자재마다 이번 발주가 책임질 기간(coverageDays) 안의 추천 발주량(안전재고 반영)만 더한다
        // — recommendedOrderQty가 없는 구 데이터는 predictedQty로 대체
        Map<Long, Double> required = new LinkedHashMap<>();
        Map<Long, String> ingName = new LinkedHashMap<>();
        Map<Long, String> ingUnit = new LinkedHashMap<>();
        // 근거 설명용 (AI 서비스 /api/explain/order): 안전재고 빼고 본 필요량, 메뉴별 기여, 식자재 설정
        Map<Long, Double> pointRequired = new LinkedHashMap<>();
        Map<Long, List<Map<String, Object>>> contributions = new LinkedHashMap<>();
        Map<Long, Ingredient> ingredients = new LinkedHashMap<>();

        for (Map.Entry<Long, List<PredictionResult>> entry : menuPredictions.entrySet()) {
            for (MenuIngredient mi : menuIngredientRepository.findByMenuId(entry.getKey())) {
                Long ingId = mi.getIngredient().getId();
                String baseUnit = mi.getIngredient().getUnit();
                String recipeUnit = mi.getUnit();
                LocalDate until = today.plusDays(coverageDays(mi.getIngredient()));
                List<PredictionResult> inWindow = entry.getValue().stream()
                        .filter(p -> !p.getPredictionDate().isAfter(until))
                        .toList();
                int menuQty = inWindow.stream()
                        .mapToInt(p -> p.getRecommendedOrderQty() != null ? p.getRecommendedOrderQty() : p.getPredictedQty())
                        .sum();
                int pointMenuQty = inWindow.stream().mapToInt(PredictionResult::getPredictedQty).sum();
                double perUnit = convertToBaseUnit(mi.getQtyPerUnit().doubleValue(), recipeUnit, baseUnit);
                required.merge(ingId, perUnit * menuQty, Double::sum);
                pointRequired.merge(ingId, perUnit * pointMenuQty, Double::sum);
                ingName.putIfAbsent(ingId, mi.getIngredient().getName());
                ingUnit.putIfAbsent(ingId, baseUnit);
                ingredients.putIfAbsent(ingId, mi.getIngredient());

                Map<String, Object> c = new LinkedHashMap<>();
                c.put("menuName", inWindow.isEmpty() ? null : inWindow.get(0).getMenu().getMenuName());
                c.put("menuQty", menuQty);
                c.put("perUnit", perUnit);
                contributions.computeIfAbsent(ingId, k -> new ArrayList<>()).add(c);
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
            // 아래는 근거 설명용 (발주량 계산에는 쓰지 않음)
            Ingredient ing = ingredients.get(ingId);
            item.put("pendingQty", alreadyOrdered);
            item.put("pointQty", round1(pointRequired.get(ingId)));
            item.put("coverageDays", coverageDays(ing));
            item.put("shelfLifeDays", ing.getShelfLifeDays());
            item.put("leadTimeDays", ing.getLeadTimeDays());
            item.put("orderCycleDays", ing.getOrderCycleDays());
            item.put("contributions", contributions.get(ingId));
            result.add(item);
        }

        return result;
    }

    // 식자재 설정이 비어 있을 때: 다음날 입고, 주 1회 입고 → 예측 7일치 전부 (이 설정이 생기기 전과 같음)
    private static final int DEFAULT_LEAD_TIME_DAYS = 1;
    private static final int DEFAULT_ORDER_CYCLE_DAYS = 7;

    // 이번 발주가 책임질 기간 (오늘부터 일수) = 입고 전 기간(리드타임 - 1일, 현재 재고·진행 중 발주로 버팀)
    // + 입고 후 다음 입고까지(발주 주기). 단 입고 후 보관기한을 넘기는 수요는 이번에 받으면 폐기되므로 뺀다
    private static int coverageDays(Ingredient ingredient) {
        int lead = ingredient.getLeadTimeDays() != null ? ingredient.getLeadTimeDays() : DEFAULT_LEAD_TIME_DAYS;
        int cycle = ingredient.getOrderCycleDays() != null ? ingredient.getOrderCycleDays() : DEFAULT_ORDER_CYCLE_DAYS;
        int usable = ingredient.getShelfLifeDays() != null ? Math.min(cycle, ingredient.getShelfLifeDays()) : cycle;
        return lead - 1 + usable;
    }

    // ── 3단계 검수 흐름 ─────────────────────────────────────────────────────────

    // 1단계: 본사 발송 검수 완료 (APPROVED → HQ_SENT) + QR 토큰 생성
    @Transactional
    public Map<String, Object> hqSend(Long id, LocalDate expiryDate) {
        OrderRequest order = getById(id);
        if (!"APPROVED".equals(order.getStatus())) {
            throw new RuntimeException("승인된 발주만 발송 처리할 수 있습니다.");
        }
        order.setStatus("HQ_SENT");
        order.setHqSentAt(LocalDateTime.now());
        order.setExpiryDate(expiryDate);
        order.setQrToken(UUID.randomUUID().toString().replace("-", ""));
        if (order.getDeliveryGroupToken() == null) {
            order.setDeliveryGroupToken(UUID.randomUUID().toString().replace("-", ""));
        }
        orderRequestRepository.save(order);
        notificationService.create(order.getStore().getId(),
            String.format("발송완료: %s %s%s 배달 출발", order.getIngredient().getName(),
                order.getOrderedQty().toPlainString(), order.getIngredient().getUnit()),
            "ORDER");

        String qrJson = String.format(
            "{\"orderId\":%d,\"token\":\"%s\",\"expiryDate\":\"%s\"}",
            order.getId(), order.getQrToken(),
            expiryDate != null ? expiryDate.toString() : ""
        );
        String qrData = Base64.getEncoder().encodeToString(qrJson.getBytes(StandardCharsets.UTF_8));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("order", order);
        result.put("qrData", qrData);
        result.put("qrToken", order.getQrToken());
        return result;
    }

    // QR 스캔으로 검수 처리 (배달기사: HQ_SENT→DRIVER_RECEIVED, 점주: DRIVER_RECEIVED→DONE)
    @Transactional
    public Map<String, Object> processQrScan(String qrData) {
        try {
            String json = new String(Base64.getDecoder().decode(qrData), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> qrMap = objectMapper.readValue(json, Map.class);
            String token = (String) qrMap.get("token");

            OrderRequest order = orderRequestRepository.findByQrToken(token)
                    .orElseThrow(() -> new RuntimeException("유효하지 않은 QR 코드입니다."));

            String previousStatus = order.getStatus();
            if ("HQ_SENT".equals(order.getStatus())) {
                order.setStatus("DRIVER_RECEIVED");
                order.setDriverReceivedAt(LocalDateTime.now());
                orderRequestRepository.save(order);
            } else if ("DRIVER_RECEIVED".equals(order.getStatus())) {
                order.setStatus("DONE");
                order.setOwnerReceivedAt(LocalDateTime.now());
                orderRequestRepository.save(order);
                applyInventory(order);
            } else {
                throw new RuntimeException("현재 상태에서 QR 스캔을 처리할 수 없습니다. 현재 상태: " + order.getStatus());
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("orderId", order.getId());
            result.put("previousStatus", previousStatus);
            result.put("newStatus", order.getStatus());
            result.put("ingredientName", order.getIngredient().getName());
            result.put("quantity", order.getOrderedQty());
            result.put("unit", order.getIngredient().getUnit());
            result.put("expiryDate", order.getExpiryDate());
            return result;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("QR 코드를 읽을 수 없습니다.", e);
        }
    }

    // 배달기사 전용 QR 스캔 — HQ_SENT→DRIVER_RECEIVED만 처리 (중복 스캔 안전)
    @Transactional
    public Map<String, Object> driverQrScan(String token) {
        OrderRequest order = orderRequestRepository.findByQrToken(token)
                .orElseThrow(() -> new RuntimeException("유효하지 않은 QR 코드입니다."));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getId());
        result.put("ingredientName", order.getIngredient().getName());
        result.put("quantity", order.getOrderedQty());
        result.put("unit", order.getIngredient().getUnit());
        result.put("storeName", order.getStore().getStoreName());
        result.put("expiryDate", order.getExpiryDate());

        if ("HQ_SENT".equals(order.getStatus())) {
            order.setStatus("DRIVER_RECEIVED");
            order.setDriverReceivedAt(LocalDateTime.now());
            orderRequestRepository.save(order);
            result.put("previousStatus", "HQ_SENT");
            result.put("newStatus", "DRIVER_RECEIVED");
            result.put("alreadyProcessed", false);
        } else {
            result.put("previousStatus", order.getStatus());
            result.put("newStatus", order.getStatus());
            result.put("alreadyProcessed", true);
        }
        return result;
    }

    // 가맹점주 전용 QR 스캔 — DRIVER_RECEIVED→DONE+재고 처리만 담당
    @Transactional
    public Map<String, Object> ownerQrScan(String token) {
        OrderRequest order = orderRequestRepository.findByQrToken(token)
                .orElseThrow(() -> new RuntimeException("유효하지 않은 QR 코드입니다."));

        if ("DONE".equals(order.getStatus())) {
            throw new RuntimeException("이미 처리된 발주입니다.");
        }
        if (!"DRIVER_RECEIVED".equals(order.getStatus())) {
            throw new RuntimeException("배달기사 수령 확인 후에만 검수할 수 있습니다. 현재 상태: " + order.getStatus());
        }

        order.setStatus("DONE");
        order.setOwnerReceivedAt(LocalDateTime.now());
        orderRequestRepository.save(order);
        applyInventory(order);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderId", order.getId());
        result.put("previousStatus", "DRIVER_RECEIVED");
        result.put("newStatus", "DONE");
        result.put("ingredientName", order.getIngredient().getName());
        result.put("quantity", order.getOrderedQty());
        result.put("unit", order.getIngredient().getUnit());
        result.put("storeName", order.getStore().getStoreName());
        result.put("expiryDate", order.getExpiryDate());
        return result;
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

    // AI 기반 자동 발주 등록 — 생성된 주문 ID 목록 반환 (엔티티 직렬화 문제 방지)
    @Transactional
    public List<Long> autoOrder(Long storeId) {
        boolean hasPredictions = !predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, LocalDate.now())
                .isEmpty();
        if (!hasPredictions) {
            throw new RuntimeException("AI 예측 데이터가 없습니다. 예측 페이지에서 먼저 예측을 실행해주세요.");
        }
        List<Map<String, Object>> recs = recommend(storeId);
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> rec : recs) {
            Long ingId = ((Number) rec.get("ingredientId")).longValue();
            Double qty = ((Number) rec.get("orderQty")).doubleValue();
            ids.add(create(storeId, ingId, qty, qty, "AUTO").getId());
        }
        return ids;
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
            inv.setUnit(ingredient.getUnit());
            result.add(inventoryRepository.save(inv));
        }
        return result;
    }

    private double convertToBaseUnit(double qty, String recipeUnit, String baseUnit) {
        return UnitUtils.convertToBaseUnit(qty, recipeUnit, baseUnit);
    }

    private double round1(double v) {
        return UnitUtils.round1(v);
    }
}
