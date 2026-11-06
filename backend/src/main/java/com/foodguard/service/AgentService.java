package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Claude 에이전트에 넘길 사실을 코드로 모은다: 식자재 설정 제안, 발주 참모, 본사 주간 리포트, 점주 질문 답변.
 * 숫자는 모두 여기서 계산하고 AI 서비스는 문장·판단만 돌려준다 (ai-service/routers/agents.py).
 */
@Service
@RequiredArgsConstructor
public class AgentService {

    static final int SUGGEST_BATCH = 30;
    static final int MIN_ORDERS_FOR_CYCLE = 4;
    static final double SALES_CHANGE_FLAG_PCT = 30;
    static final int ASSISTANT_SALES_DAYS = 14;

    private final AiClient aiClient;
    private final OrderRequestService orderRequestService;
    private final WatchdogService watchdogService;
    private final IngredientRepository ingredientRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;
    private final WasteRecordRepository wasteRecordRepository;

    // ── 식자재 설정 제안 ──

    // 보관기한·발주 주기·리드타임 중 하나라도 빈 식자재만. 발주 간격·입고 기간은 이력이 충분하면 실제 값을 넘긴다
    @Transactional(readOnly = true)
    public Map<String, Object> suggestIngredientSettings(Long storeId) {
        List<Ingredient> unset = ingredientRepository.findByStoreIdIncludingLegacy(storeId).stream()
                .filter(i -> i.getShelfLifeDays() == null || i.getOrderCycleDays() == null || i.getLeadTimeDays() == null)
                .toList();
        Map<Long, List<OrderRequest>> orders = orderRequestRepository.findByStoreId(storeId).stream()
                .filter(o -> !"CANCELLED".equals(o.getStatus()))
                .collect(Collectors.groupingBy(o -> o.getIngredient().getId()));

        List<Ingredient> batch = unset.stream().limit(SUGGEST_BATCH).toList();
        List<Map<String, Object>> items = new ArrayList<>();
        for (Ingredient i : batch) {
            List<OrderRequest> history = orders.getOrDefault(i.getId(), List.of());
            Map<String, Object> item = new HashMap<>();
            item.put("ingredientId", i.getId());
            item.put("name", i.getName());
            item.put("unit", i.getUnit());
            item.put("category", i.getCategory());
            item.put("observedCycleDays", observedCycleDays(history));
            item.put("observedLeadDays", observedLeadDays(history));
            items.add(item);
        }
        Map<String, Object> result = new HashMap<>(aiClient.post("/api/agents/ingredient-settings", Map.of("items", items)));
        result.put("remaining", unset.size() - batch.size());
        return result;
    }

    // 발주일 간격의 중앙값. 발주가 적으면 null (추정에 맡긴다)
    static Integer observedCycleDays(List<OrderRequest> orders) {
        List<LocalDate> days = orders.stream().filter(o -> o.getOrderedAt() != null)
                .map(o -> o.getOrderedAt().toLocalDate()).distinct().sorted().toList();
        if (days.size() < MIN_ORDERS_FOR_CYCLE) return null;
        List<Long> gaps = new ArrayList<>();
        for (int i = 1; i < days.size(); i++) gaps.add(ChronoUnit.DAYS.between(days.get(i - 1), days.get(i)));
        return (int) median(gaps);
    }

    // 발주 → 점주 입고 확인까지의 일수 중앙값
    static Integer observedLeadDays(List<OrderRequest> orders) {
        List<Long> leads = orders.stream()
                .filter(o -> o.getOrderedAt() != null && o.getOwnerReceivedAt() != null)
                .map(o -> ChronoUnit.DAYS.between(o.getOrderedAt().toLocalDate(), o.getOwnerReceivedAt().toLocalDate()))
                .filter(d -> d >= 1)
                .toList();
        return leads.size() < 3 ? null : (int) median(leads);
    }

    private static long median(List<Long> values) {
        List<Long> sorted = values.stream().sorted().toList();
        return sorted.get(sorted.size() / 2);
    }

    // ── 발주 참모 ──

    @Transactional(readOnly = true)
    public Map<String, Object> reviewOrder(Long storeId) {
        Map<Long, LocalDate> expiry = new HashMap<>();
        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            if (inv.getExpiryDate() != null) expiry.put(inv.getIngredient().getId(), inv.getExpiryDate());
        }
        List<Map<String, Object>> recommendations = orderRequestService.recommend(storeId);
        List<Map<String, Object>> items = recommendations.stream().map(r -> {
            Map<String, Object> item = new HashMap<>(r);
            item.put("stockExpiry", expiry.get(((Number) r.get("ingredientId")).longValue()));
            return item;
        }).toList();
        List<String> warnings = watchdogService.findings(storeId).stream()
                .filter(f -> !"LOW".equals(f.get("severity")))
                .map(f -> (String) f.get("message"))
                .toList();

        Map<String, Object> body = new HashMap<>();
        body.put("storeName", storeRepository.findById(storeId).map(Store::getStoreName).orElse(null));
        body.put("warnings", warnings);
        body.put("items", items);
        return Map.of("recommendations", recommendations, "review", aiClient.post("/api/agents/order-review", body));
    }

    // ── 본사 주간 리포트 ──

    @Transactional(readOnly = true)
    public Map<String, Object> hqWeeklyReport() {
        LocalDate end = salesDataRepository.findLastSaleDateAllStores();
        if (end == null) throw new RuntimeException("판매 기록이 없어 리포트를 만들 수 없습니다.");
        Map<String, Object> facts = weeklyFacts(end,
                revenueByStore(end.minusDays(6), end), revenueByStore(end.minusDays(13), end.minusDays(7)),
                storeRepository.findAll(), wasteRecordRepository.findAll(), orderRequestRepository.findAll());
        return Map.of("facts", facts, "report", aiClient.post("/api/agents/hq-weekly", facts));
    }

    private Map<Long, Long> revenueByStore(LocalDate start, LocalDate end) {
        return salesDataRepository.sumRevenueAllStoresBetween(start, end).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));
    }

    // 기준일은 전 매장 마지막 판매일까지의 7일. 직전 7일에도 이번 7일에도 판매가 없는 매장은 뺀다
    static Map<String, Object> weeklyFacts(LocalDate end, Map<Long, Long> current, Map<Long, Long> previous,
                                           List<Store> stores, List<WasteRecord> wastes, List<OrderRequest> orders) {
        LocalDate start = end.minusDays(6);
        Map<Long, Long> wasteCount = wastes.stream()
                .filter(w -> !w.getWasteDate().isBefore(start) && !w.getWasteDate().isAfter(end))
                .collect(Collectors.groupingBy(WasteRecord::getStoreId, Collectors.counting()));
        Map<Long, Long> waiting = orders.stream().filter(o -> "REQUESTED".equals(o.getStatus()))
                .collect(Collectors.groupingBy(o -> o.getStore().getId(), Collectors.counting()));

        List<Map<String, Object>> list = new ArrayList<>();
        for (Store s : stores) {
            Long now = current.get(s.getId()), before = previous.get(s.getId());
            if (now == null && before == null) continue;
            List<String> flags = new ArrayList<>();
            Double change = null;
            if (now == null) {
                flags.add("NO_SALES_INPUT");
            } else if (before != null && before > 0) {
                change = Math.round((now - before) * 1000.0 / before) / 10.0;
                if (change <= -SALES_CHANGE_FLAG_PCT) flags.add("SALES_DROP");
                if (change >= SALES_CHANGE_FLAG_PCT) flags.add("SALES_SURGE");
            }
            long waste = wasteCount.getOrDefault(s.getId(), 0L);
            if (waste > 0) flags.add("WASTE_RECORDED");
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("storeId", s.getId());
            item.put("storeName", s.getStoreName());
            item.put("revenue", now == null ? 0 : now);
            item.put("previousRevenue", before == null ? 0 : before);
            item.put("changePct", change);
            item.put("wasteRecords", waste);
            item.put("ordersWaitingApproval", waiting.getOrDefault(s.getId(), 0L));
            item.put("flags", flags);
            list.add(item);
        }
        Map<String, Object> facts = new LinkedHashMap<>();
        facts.put("periodStart", start.toString());
        facts.put("periodEnd", end.toString());
        facts.put("storeCount", list.size());
        facts.put("stores", list);
        return facts;
    }

    // ── 점주 질문 답변 ──

    @Transactional(readOnly = true)
    public Map<String, Object> ask(Long storeId, String question) {
        Map<String, Object> body = new HashMap<>();
        body.put("question", question);
        body.put("data", storeSnapshot(storeId));
        return aiClient.post("/api/agents/assistant", body);
    }

    // 이 매장 데이터만 담는다. 합계·일별 값은 Claude 가 계산하지 않게 미리 넣는다
    Map<String, Object> storeSnapshot(Long storeId) {
        LocalDate today = LocalDate.now();
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("today", today.toString());
        data.put("storeName", storeRepository.findById(storeId).map(Store::getStoreName).orElse(null));

        LocalDate last = salesDataRepository.findLastSaleDate(storeId);
        data.put("lastSalesEntryDate", last);
        if (last != null) {
            Map<String, Integer> byMenu = new TreeMap<>();
            for (SalesData s : salesDataRepository.findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, last.minusDays(ASSISTANT_SALES_DAYS - 1), last)) {
                byMenu.merge(s.getMenu().getMenuName(), s.getQuantity(), Integer::sum);
            }
            data.put("recentSales", Map.of("from", last.minusDays(ASSISTANT_SALES_DAYS - 1).toString(), "to", last.toString(), "quantityByMenu", byMenu));
        }

        Map<String, Integer> forecastByMenu = new TreeMap<>();
        Map<String, Integer> forecastByDate = new TreeMap<>();
        for (PredictionResult p : predictionResultRepository.findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today)) {
            forecastByMenu.merge(p.getMenu().getMenuName(), p.getPredictedQty(), Integer::sum);
            forecastByDate.merge(p.getPredictionDate().toString(), p.getPredictedQty(), Integer::sum);
        }
        data.put("forecastTotalByMenu", forecastByMenu);
        data.put("forecastTotalByDate", forecastByDate);

        data.put("orderRecommendations", orderRequestService.recommend(storeId).stream().map(r -> Map.of(
                "ingredient", r.get("ingredientName"), "orderQty", r.get("orderQty"), "unit", r.get("unit"),
                "requiredQty", r.get("requiredQty"), "currentStock", r.get("currentStock"))).toList());
        data.put("inventory", inventoryRepository.findByStoreId(storeId).stream().map(i -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("ingredient", i.getIngredient().getName());
            item.put("quantity", i.getCurrentQty());
            item.put("unit", i.getUnit());
            item.put("expiryDate", i.getExpiryDate());
            return item;
        }).toList());
        data.put("openOrders", orderRequestRepository.findByStoreIdAndStatusIn(storeId, List.of("REQUESTED", "APPROVED")).stream().map(o -> Map.of(
                "ingredient", o.getIngredient().getName(), "quantity", o.getOrderedQty(), "status", o.getStatus())).toList());
        data.put("alerts", watchdogService.findings(storeId).stream().map(f -> f.get("message")).toList());
        // 건수도 넣어 둔다. Claude 가 세면 답변의 숫자가 데이터에 없는 값으로 표시된다
        data.put("counts", Map.of(
                "orderRecommendations", ((List<?>) data.get("orderRecommendations")).size(),
                "inventory", ((List<?>) data.get("inventory")).size(),
                "openOrders", ((List<?>) data.get("openOrders")).size(),
                "alerts", ((List<?>) data.get("alerts")).size()));
        return data;
    }
}
