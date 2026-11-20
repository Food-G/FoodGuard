package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.Notification;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.PredictionResult;
import com.foodguard.entity.Store;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.NotificationRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.PredictionResultRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.util.UnitUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 재고·데이터 이상 감시. LLM 없이 규칙으로만 찾는다 (같은 데이터면 항상 같은 결과, 오탐 원인을 코드로 확인 가능).
 * 조회는 저장하지 않고, 매일 정해진 시각의 실행(WatchdogScheduler)만 알림을 만든다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WatchdogService {

    static final int WASTE_RISK_DAYS = 7;
    static final int STALE_SALES_DAYS = 3;
    static final int STUCK_ORDER_DAYS = 3;

    private final InventoryRepository inventoryRepository;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final PredictionResultRepository predictionResultRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final SalesDataRepository salesDataRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> findings(Long storeId) {
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> out = new ArrayList<>();

        List<PredictionResult> predictions = predictionResultRepository
                .findByStore_IdAndPredictionDateGreaterThanEqualOrderByPredictionDateAsc(storeId, today);
        // 활성 메뉴의 레시피: 메뉴 → 식자재 사용량
        Map<Long, List<MenuIngredient>> recipes = new HashMap<>();
        Set<Ingredient> recipeIngredients = new HashSet<>();
        for (Menu menu : menuRepository.findByStoreIdAndIsActiveTrue(storeId)) {
            List<MenuIngredient> recipe = menuIngredientRepository.findByMenuId(menu.getId());
            recipes.put(menu.getId(), recipe);
            recipe.forEach(mi -> recipeIngredients.add(mi.getIngredient()));
            if (recipe.isEmpty()) {
                out.add(finding("MISSING_RECIPE", "MEDIUM", "STOCK",
                        String.format("메뉴 '%s'에 레시피가 없어 발주 계산에서 빠집니다.", menu.getMenuName())));
            }
        }

        for (Inventory inv : inventoryRepository.findByStoreId(storeId)) {
            String name = inv.getIngredient().getName();
            double stock = inv.getCurrentQty().doubleValue();
            LocalDate expiry = inv.getExpiryDate();
            if (stock < 0) {
                out.add(finding("NEGATIVE_STOCK", "HIGH", "STOCK",
                        String.format("%s 재고가 %s%s 입니다. 실사 후 재고를 맞춰 주세요.", name, fmt(stock), inv.getUnit())));
            } else if (stock > 0 && expiry != null && expiry.isBefore(today)) {
                out.add(finding("EXPIRED_STOCK", "HIGH", "WASTE",
                        String.format("%s %s%s 의 유통기한(%s)이 지났습니다.", name, fmt(stock), inv.getUnit(), expiry)));
            } else if (stock > 0 && expiry != null && !predictions.isEmpty() && !expiry.isAfter(today.plusDays(WASTE_RISK_DAYS))) {
                double usage = usageUntil(inv.getIngredient(), expiry, predictions, recipes);
                if (stock > usage) {
                    out.add(finding("WASTE_RISK", "HIGH", "WASTE",
                            String.format("%s 재고 %s%s 중 유통기한(%s)까지 예측 사용량은 %s%s 라 %s%s 가 폐기될 수 있습니다.",
                                    name, fmt(stock), inv.getUnit(), expiry, fmt(usage), inv.getUnit(), fmt(stock - usage), inv.getUnit())));
                }
            }
        }

        if (predictions.isEmpty() && !recipes.isEmpty()) {
            out.add(finding("NO_FORECAST", "MEDIUM", "ACCURACY", "오늘 이후 수요 예측이 없습니다. AI 수요 예측을 실행해 주세요."));
        }
        LocalDate lastSale = salesDataRepository.findLastSaleDate(storeId);
        if (lastSale != null && ChronoUnit.DAYS.between(lastSale, today) > STALE_SALES_DAYS) {
            out.add(finding("STALE_SALES", "MEDIUM", "ACCURACY",
                    String.format("마지막 판매 입력이 %s 입니다. 입력이 밀리면 예측이 부정확해집니다. 쉬는 날이라면 휴무로 기록해 주세요.", lastSale)));
        }
        LocalDateTime stuckBefore = LocalDateTime.now().minusDays(STUCK_ORDER_DAYS);
        for (OrderRequest o : orderRequestRepository.findByStoreIdAndStatus(storeId, "REQUESTED")) {
            if (o.getOrderedAt() != null && o.getOrderedAt().isBefore(stuckBefore)) {
                out.add(finding("STUCK_ORDER", "MEDIUM", "ORDER",
                        String.format("%s 발주가 %s 부터 승인을 기다리고 있습니다.", o.getIngredient().getName(), o.getOrderedAt().toLocalDate())));
            }
        }
        long unset = recipeIngredients.stream().filter(i -> i.getShelfLifeDays() == null).count();
        if (unset > 0) {
            out.add(finding("MISSING_SETTINGS", "LOW", "STOCK",
                    String.format("레시피 식자재 %d개에 보관기한이 없어 7일치 기준으로 발주합니다. 식자재 관리의 AI 설정 제안을 써 보세요.", unset)));
        }
        return out;
    }

    // 전 매장 점검 → HIGH·MEDIUM 을 알림으로. 같은 내용의 안 읽은 알림이 있으면 만들지 않는다
    public int notifyAllStores() {
        int created = 0;
        for (Store store : storeRepository.findAll()) {
            try {
                created += notifyStore(store.getId());
            } catch (RuntimeException e) {
                log.warn("매장 {} 점검 실패: {}", store.getId(), e.getMessage());
            }
        }
        return created;
    }

    @Transactional
    public int notifyStore(Long storeId) {
        Set<String> unread = notificationRepository.findByStoreIdAndIsReadFalse(storeId).stream()
                .map(Notification::getMessage).collect(Collectors.toSet());
        int created = 0;
        for (Map<String, Object> f : findings(storeId)) {
            String message = (String) f.get("message");
            if (!"LOW".equals(f.get("severity")) && unread.add(message)) {
                notificationService.create(storeId, message, (String) f.get("notificationType"));
                created++;
            }
        }
        return created;
    }

    private double usageUntil(Ingredient ingredient, LocalDate until, List<PredictionResult> predictions, Map<Long, List<MenuIngredient>> recipes) {
        double usage = 0;
        for (PredictionResult p : predictions) {
            if (p.getPredictionDate().isAfter(until)) continue;
            for (MenuIngredient mi : recipes.getOrDefault(p.getMenu().getId(), List.of())) {
                if (mi.getIngredient().getId().equals(ingredient.getId())) {
                    usage += p.getPredictedQty() * UnitUtils.convertToBaseUnit(mi.getQtyPerUnit().doubleValue(), mi.getUnit(), ingredient.getUnit());
                }
            }
        }
        return usage;
    }

    private static Map<String, Object> finding(String type, String severity, String notificationType, String message) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("type", type);
        f.put("severity", severity);
        f.put("notificationType", notificationType);
        f.put("message", message);
        return f;
    }

    private static String fmt(double v) {
        return String.valueOf(Math.round(v * 10) / 10.0);
    }
}
