package com.foodguard.service;

import com.foodguard.entity.Inventory;
import com.foodguard.entity.OrderRequest;
import com.foodguard.entity.SalesData;
import com.foodguard.entity.Store;
import com.foodguard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final StoreRepository storeRepository;
    private final SalesDataRepository salesDataRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final NotificationRepository notificationRepository;

    // 점주 대시보드
    public Map<String, Object> getStoreDashboard(Long storeId) {
        Map<String, Object> dashboard = new HashMap<>();

        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        LocalDate monthStart = today.withDayOfMonth(1);

        // 주간 매출 합계
        List<SalesData> weeklySales = salesDataRepository
                .findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, weekStart, today);
        int weeklyTotal = weeklySales.stream()
                .mapToInt(s -> s.getTotalPrice() != null ? s.getTotalPrice() : 0)
                .sum();
        long weeklyCount = weeklySales.size();

        // 월간 매출 합계
        List<SalesData> monthlySales = salesDataRepository
                .findByStoreIdAndSaleDateBetweenAndIsDeletedFalse(storeId, monthStart, today);
        int monthlyTotal = monthlySales.stream()
                .mapToInt(s -> s.getTotalPrice() != null ? s.getTotalPrice() : 0)
                .sum();

        // 재고 부족 항목 수
        List<Inventory> lowStock = inventoryRepository.findLowStockByStoreId(storeId);

        // 대기 중인 발주
        List<OrderRequest> pendingOrders = orderRequestRepository
                .findByStoreIdAndStatus(storeId, "REQUESTED");

        // 읽지 않은 알림 수
        long unreadCount = notificationRepository.findByStoreIdAndIsReadFalse(storeId).size();

        dashboard.put("weeklyRevenue", weeklyTotal);
        dashboard.put("weeklySalesCount", weeklyCount);
        dashboard.put("monthlyRevenue", monthlyTotal);
        dashboard.put("lowStockCount", lowStock.size());
        dashboard.put("pendingOrderCount", pendingOrders.size());
        dashboard.put("unreadNotificationCount", unreadCount);
        dashboard.put("lowStockItems", lowStock.stream().map(i -> Map.of(
                "ingredientName", i.getIngredient().getName(),
                "currentQty", i.getCurrentQty(),
                "minThreshold", i.getMinThreshold(),
                "unit", i.getUnit()
        )).collect(Collectors.toList()));

        return dashboard;
    }

    // 본사 통합 대시보드
    public Map<String, Object> getHQDashboard() {
        Map<String, Object> dashboard = new HashMap<>();

        long totalStores = storeRepository.count();
        long activeStores = storeRepository.countByIsActiveTrue();

        // 전체 대기 발주
        List<OrderRequest> allPending = orderRequestRepository.findAll().stream()
                .filter(o -> "REQUESTED".equals(o.getStatus()))
                .collect(Collectors.toList());

        // 오늘 전체 매출
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        List<SalesData> allWeeklySales = salesDataRepository.findAll().stream()
                .filter(s -> !s.isDeleted()
                        && s.getSaleDate() != null
                        && !s.getSaleDate().isBefore(weekStart)
                        && !s.getSaleDate().isAfter(today))
                .collect(Collectors.toList());

        int totalWeeklyRevenue = allWeeklySales.stream()
                .mapToInt(s -> s.getTotalPrice() != null ? s.getTotalPrice() : 0)
                .sum();

        // 가맹점별 요약
        List<Store> stores = storeRepository.findAll();
        List<Map<String, Object>> storesSummary = stores.stream().map(store -> {
            long storeUnread = notificationRepository.findByStoreIdAndIsReadFalse(store.getId()).size();
            long storeLowStock = inventoryRepository.findLowStockByStoreId(store.getId()).size();
            return Map.<String, Object>of(
                    "storeId", store.getId(),
                    "storeName", store.getStoreName(),
                    "region", store.getRegion(),
                    "isActive", store.isActive(),
                    "lowStockCount", storeLowStock,
                    "unreadAlerts", storeUnread
            );
        }).collect(Collectors.toList());

        dashboard.put("totalStores", totalStores);
        dashboard.put("activeStores", activeStores);
        dashboard.put("pendingOrderCount", allPending.size());
        dashboard.put("totalWeeklyRevenue", totalWeeklyRevenue);
        dashboard.put("storesSummary", storesSummary);

        return dashboard;
    }
}
