package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Menu;
import com.foodguard.entity.SalesData;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * POS 판매 파일·거래명세서 입력. preview 는 저장하지 않고 AI 해석 결과만 돌려주고, 점주가 확인한 행을 commit 이 저장한다.
 */
@Service
@RequiredArgsConstructor
public class IngestService {

    private final AiClient aiClient;
    private final MenuRepository menuRepository;
    private final IngredientRepository ingredientRepository;
    private final InventoryRepository inventoryRepository;
    private final SalesDataRepository salesDataRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> previewSales(Long storeId, Map<String, Object> file) {
        List<Map<String, Object>> menus = menuRepository.findByStoreIdAndIsActiveTrue(storeId).stream()
                .map(m -> Map.<String, Object>of("id", m.getId(), "name", m.getMenuName()))
                .toList();
        Map<String, Object> request = new HashMap<>(file);
        request.put("menus", menus);
        Map<String, Object> result = new HashMap<>(aiClient.post("/api/ingest/sales-file", request));

        // 이미 입력된 날짜·메뉴를 표시한다 (같은 파일을 두 번 올려도 판매가 두 배가 되지 않게)
        Set<String> existing = existingSales(storeId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("rows");
        result.put("rows", rows.stream().map(r -> {
            Map<String, Object> row = new HashMap<>(r);
            row.put("alreadyEntered", r.get("menuId") != null && existing.contains(r.get("saleDate") + "/" + r.get("menuId")));
            return row;
        }).toList());
        return result;
    }

    // 다른 매장 메뉴·미래 날짜는 거부하고, 이미 입력된 날짜·메뉴는 건너뛴다
    @Transactional
    public Map<String, Object> commitSales(Long storeId, List<Map<String, Object>> rows) {
        Map<Long, Menu> menus = menuRepository.findByStoreId(storeId).stream()
                .collect(Collectors.toMap(Menu::getId, Function.identity()));
        Set<String> existing = existingSales(storeId);
        int created = 0, skipped = 0;
        for (Map<String, Object> row : rows) {
            Menu menu = menus.get(Long.valueOf(row.get("menuId").toString()));
            if (menu == null) throw new RuntimeException("이 가맹점의 메뉴가 아닙니다.");
            LocalDate date = LocalDate.parse(row.get("saleDate").toString());
            int quantity = Integer.parseInt(row.get("quantity").toString());
            if (quantity <= 0) throw new RuntimeException("판매 수량은 1 이상이어야 합니다.");
            if (date.isAfter(LocalDate.now())) throw new RuntimeException("미래 날짜의 판매는 등록할 수 없습니다: " + date);
            if (!existing.add(date + "/" + menu.getId())) {
                skipped++;
                continue;
            }
            SalesData sale = new SalesData();
            sale.setStore(menu.getStore());
            sale.setMenu(menu);
            sale.setQuantity(quantity);
            sale.setSaleDate(date);
            salesDataRepository.save(sale);
            created++;
        }
        return Map.of("created", created, "skippedExisting", skipped);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> previewInvoice(Long storeId, Map<String, Object> file) {
        Map<String, Object> request = new HashMap<>(file);
        // 공용 식자재에 같은 이름이 여러 개 있으면 이 매장 재고에 있는 쪽을 쓴다 (AI 가 고르지 못하고 빈칸이 된다)
        Set<Long> stocked = inventoryRepository.findByStoreId(storeId).stream()
                .map(i -> i.getIngredient().getId()).collect(Collectors.toSet());
        Map<String, Ingredient> byName = new LinkedHashMap<>();
        for (Ingredient i : ingredientRepository.findByStoreIdIncludingLegacy(storeId)) {
            Ingredient same = byName.get(i.getName());
            if (same == null || (stocked.contains(i.getId()) && !stocked.contains(same.getId()))) byName.put(i.getName(), i);
        }
        request.put("ingredients", byName.values().stream()
                .map(i -> Map.<String, Object>of("id", i.getId(), "name", i.getName(), "unit", i.getUnit()))
                .toList());
        return aiClient.post("/api/ingest/invoice", request);
    }

    // 재고에 더하고 유통기한은 더 이른 쪽을 남긴다 (발주 입고 처리와 같은 규칙)
    @Transactional
    public Map<String, Object> commitInvoice(Long storeId, List<Map<String, Object>> items) {
        Map<Long, Ingredient> ingredients = ingredientRepository.findByStoreIdIncludingLegacy(storeId).stream()
                .collect(Collectors.toMap(Ingredient::getId, Function.identity()));
        int updated = 0;
        for (Map<String, Object> item : items) {
            Ingredient ingredient = ingredients.get(Long.valueOf(item.get("ingredientId").toString()));
            if (ingredient == null) throw new RuntimeException("이 가맹점의 식자재가 아닙니다.");
            double quantity = Double.parseDouble(item.get("quantity").toString());
            if (quantity <= 0) throw new RuntimeException("입고 수량은 0 보다 커야 합니다.");
            Object expiryValue = item.get("expiryDate");
            LocalDate expiry = expiryValue == null || expiryValue.toString().isBlank() ? null : LocalDate.parse(expiryValue.toString());

            Inventory inventory = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingredient.getId()).orElseGet(() -> {
                Inventory created = new Inventory();
                created.setStore(storeRepository.getReferenceById(storeId));
                created.setIngredient(ingredient);
                created.setCurrentQty(BigDecimal.ZERO);
                created.setUnit(ingredient.getUnit());
                return created;
            });
            inventory.setCurrentQty(inventory.getCurrentQty().add(BigDecimal.valueOf(quantity)));
            if (expiry != null && (inventory.getExpiryDate() == null || expiry.isBefore(inventory.getExpiryDate()))) {
                inventory.setExpiryDate(expiry);
            }
            inventoryRepository.save(inventory);
            updated++;
        }
        return Map.of("updated", updated);
    }

    private Set<String> existingSales(Long storeId) {
        return salesDataRepository.findByStoreIdAndIsDeletedFalse(storeId).stream()
                .map(s -> s.getSaleDate() + "/" + s.getMenu().getId())
                .collect(Collectors.toCollection(HashSet::new));
    }
}
