package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.entity.Store;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.OrderRequestRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

/**
 * 문자로 메뉴·레시피·식자재 관리. Claude 는 요청을 변경 목록으로만 바꾸고, 검사·미리보기·저장은 코드가 한다.
 * 식자재는 이름으로 찾는다 (Claude 가 준 id 를 믿지 않음). 점주가 미리보기를 확인한 뒤에만 저장한다.
 */
@Service
@RequiredArgsConstructor
public class MenuAgentService {

    static final Set<String> OPS = Set.of("ADD_MENU", "UPDATE_MENU", "DELETE_MENU", "ADD_INGREDIENTS", "REMOVE_INGREDIENTS", "DELETE_INGREDIENT");

    private final AiClient aiClient;
    private final MenuRepository menuRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final IngredientRepository ingredientRepository;
    private final InventoryRepository inventoryRepository;
    private final OrderRequestRepository orderRequestRepository;
    private final StoreRepository storeRepository;

    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public Map<String, Object> propose(Long storeId, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("message", message);
        body.put("menus", menuContext(storeId));
        body.put("ingredients", ingredientRepository.findByStoreIdIncludingLegacy(storeId).stream()
                .map(i -> Map.<String, Object>of("id", i.getId(), "name", i.getName(), "unit", i.getUnit(), "shared", i.getStore() == null))
                .toList());
        Map<String, Object> ai = aiClient.post("/api/agents/menu-changes", body);

        Context ctx = new Context(storeId);
        List<Map<String, Object>> previews = new ArrayList<>();
        for (Map<String, Object> change : (List<Map<String, Object>>) ai.getOrDefault("changes", List.of())) {
            previews.add(normalize(change, ctx));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("understood", ai.get("understood"));
        result.put("clarification", ai.get("clarification"));
        result.put("changes", previews);
        return result;
    }

    // 미리보기에서 점주가 사용량을 고쳤을 수 있으므로 저장 직전에 다시 검사한다
    @Transactional
    public Map<String, Object> apply(Long storeId, List<Map<String, Object>> changes) {
        if (changes == null || changes.isEmpty()) throw new RuntimeException("반영할 내용이 없습니다.");
        Store store = storeRepository.findById(storeId).orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Context ctx = new Context(storeId);
        for (Map<String, Object> raw : changes) {
            Map<String, Object> c = normalize(raw, ctx);
            String op = (String) c.get("op");
            switch (op) {
                case "ADD_MENU" -> {
                    Menu menu = new Menu();
                    menu.setStore(store);
                    menu.setMenuName((String) c.get("menuName"));
                    menu.setPrice((Integer) c.get("price"));
                    menu.setCategory((String) c.get("category"));
                    menuRepository.save(menu);
                    ctx.menus.put(menu.getId(), menu);
                    ctx.recipes.put(menu.getId(), new ArrayList<>());
                    addIngredients(menu, c, store, ctx);
                }
                case "UPDATE_MENU" -> {
                    Menu menu = ctx.menu(c.get("menuId"));
                    menu.setMenuName((String) c.get("menuName"));
                    menu.setPrice((Integer) c.get("price"));
                    menuRepository.save(menu);
                }
                case "DELETE_MENU" -> {
                    // 판매 기록이 메뉴를 참조하므로 비활성화만 한다
                    Menu menu = ctx.menu(c.get("menuId"));
                    menu.setIsActive(false);
                    menuRepository.save(menu);
                }
                case "ADD_INGREDIENTS" -> addIngredients(ctx.menu(c.get("menuId")), c, store, ctx);
                case "REMOVE_INGREDIENTS" -> {
                    Long menuId = toLong(c.get("menuId"));
                    Set<Long> remove = new HashSet<>();
                    for (Map<String, Object> r : list(c.get("removeIngredients"))) remove.add(toLong(r.get("ingredientId")));
                    for (MenuIngredient mi : new ArrayList<>(ctx.recipes.get(menuId))) {
                        if (remove.contains(mi.getIngredient().getId())) {
                            menuIngredientRepository.delete(mi);
                            ctx.recipes.get(menuId).remove(mi);
                        }
                    }
                }
                case "DELETE_INGREDIENT" -> {
                    Long id = toLong(c.get("ingredientId"));
                    for (List<MenuIngredient> recipe : ctx.recipes.values()) {
                        for (MenuIngredient mi : new ArrayList<>(recipe)) {
                            if (mi.getIngredient().getId().equals(id)) {
                                menuIngredientRepository.delete(mi);
                                recipe.remove(mi);
                            }
                        }
                    }
                    inventoryRepository.findByStoreIdAndIngredientId(storeId, id).ifPresent(inventoryRepository::delete);
                    ingredientRepository.deleteById(id);
                    ctx.removeIngredient(id);
                }
                default -> throw new RuntimeException("지원하지 않는 변경입니다.");
            }
        }
        return Map.of("applied", changes.size());
    }

    private void addIngredients(Menu menu, Map<String, Object> c, Store store, Context ctx) {
        for (Map<String, Object> item : list(c.get("ingredients"))) {
            String name = (String) item.get("name");
            Ingredient ingredient = ctx.findIngredient(name);
            if (ingredient == null) {
                ingredient = new Ingredient();
                ingredient.setStore(store);
                ingredient.setName(name);
                ingredient.setUnit((String) item.get("baseUnit"));
                ingredient = ingredientRepository.save(ingredient);
                ctx.addIngredient(ingredient);
            }
            BigDecimal qty = BigDecimal.valueOf(((Number) item.get("qtyPerUnit")).doubleValue());
            Long ingredientId = ingredient.getId();
            MenuIngredient mi = ctx.recipes.get(menu.getId()).stream()
                    .filter(x -> x.getIngredient().getId().equals(ingredientId)).findFirst().orElse(null);
            if (mi == null) {
                mi = new MenuIngredient();
                mi.setMenu(menu);
                mi.setIngredient(ingredient);
                ctx.recipes.get(menu.getId()).add(mi);
            }
            mi.setQtyPerUnit(qty);
            mi.setUnit((String) item.get("unit"));
            menuIngredientRepository.save(mi);
        }
    }

    // 변경 하나를 검사하고 화면에 보일 값으로 정리한다. 잘못되면 점주가 읽을 문구로 거부
    @SuppressWarnings("unchecked")
    private Map<String, Object> normalize(Map<String, Object> change, Context ctx) {
        String op = String.valueOf(change.get("op"));
        if (!OPS.contains(op)) throw new RuntimeException("지원하지 않는 변경입니다.");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("op", op);
        switch (op) {
            case "ADD_MENU" -> {
                String name = text(change.get("menuName"));
                if (name == null) throw new RuntimeException("메뉴 이름이 필요합니다.");
                if (ctx.activeMenuByName(name) != null) throw new RuntimeException("'" + name + "' 메뉴가 이미 있습니다.");
                out.put("menuName", name);
                out.put("price", price(change.get("price")));
                out.put("category", text(change.get("category")));
                out.put("ingredients", ingredients(list(change.get("ingredients")), ctx, null));
                out.put("removeIngredients", List.of());
            }
            case "UPDATE_MENU" -> {
                Menu menu = ctx.menu(change.get("menuId"));
                String name = text(change.get("menuName"));
                if (name == null) name = menu.getMenuName();
                Menu same = ctx.activeMenuByName(name);
                if (same != null && !same.getId().equals(menu.getId())) throw new RuntimeException("'" + name + "' 메뉴가 이미 있습니다.");
                out.put("menuId", menu.getId());
                out.put("currentName", menu.getMenuName());
                out.put("currentPrice", menu.getPrice());
                out.put("menuName", name);
                out.put("price", change.get("price") == null ? menu.getPrice() : price(change.get("price")));
            }
            case "DELETE_MENU" -> {
                Menu menu = ctx.menu(change.get("menuId"));
                out.put("menuId", menu.getId());
                out.put("menuName", menu.getMenuName());
            }
            case "ADD_INGREDIENTS" -> {
                Menu menu = ctx.menu(change.get("menuId"));
                out.put("menuId", menu.getId());
                out.put("menuName", menu.getMenuName());
                List<Map<String, Object>> items = ingredients(list(change.get("ingredients")), ctx, menu.getId());
                if (items.isEmpty()) throw new RuntimeException("추가할 식자재가 없습니다.");
                out.put("ingredients", items);
            }
            case "REMOVE_INGREDIENTS" -> {
                Menu menu = ctx.menu(change.get("menuId"));
                out.put("menuId", menu.getId());
                out.put("menuName", menu.getMenuName());
                List<Map<String, Object>> removed = new ArrayList<>();
                Object ids = change.containsKey("removeIngredients") ? change.get("removeIngredients") : change.get("removeIngredientIds");
                for (Object id : (List<Object>) ids) {
                    Long ingredientId = id instanceof Map<?, ?> m ? toLong(m.get("ingredientId")) : toLong(id);
                    MenuIngredient mi = ctx.recipes.get(menu.getId()).stream()
                            .filter(x -> x.getIngredient().getId().equals(ingredientId)).findFirst()
                            .orElseThrow(() -> new RuntimeException(menu.getMenuName() + " 레시피에 없는 식자재입니다."));
                    removed.add(Map.of("ingredientId", ingredientId, "name", mi.getIngredient().getName()));
                }
                if (removed.isEmpty()) throw new RuntimeException("뺄 식자재가 없습니다.");
                out.put("removeIngredients", removed);
            }
            case "DELETE_INGREDIENT" -> {
                Ingredient ingredient = ctx.ingredient(change.get("ingredientId"));
                checkDeletable(ingredient, ctx.storeId);
                out.put("ingredientId", ingredient.getId());
                out.put("ingredientName", ingredient.getName());
                out.put("usedBy", ctx.menusUsing(ingredient.getId()));
            }
            default -> throw new RuntimeException("지원하지 않는 변경입니다.");
        }
        return out;
    }

    // 공용 식자재는 다른 매장도 쓴다. 발주 기록·재고가 있으면 지우지 않는다 (기록이 함께 사라진다)
    private void checkDeletable(Ingredient ingredient, Long storeId) {
        String name = ingredient.getName();
        if (ingredient.getStore() == null) {
            throw new RuntimeException(name + "은(는) 공용 식자재라 삭제할 수 없습니다. 메뉴 레시피에서 빼는 것은 가능합니다.");
        }
        if (orderRequestRepository.existsByIngredientId(ingredient.getId())) {
            throw new RuntimeException(name + "은(는) 발주 기록이 있어 삭제할 수 없습니다. 메뉴 레시피에서 빼는 것은 가능합니다.");
        }
        Optional<Inventory> inventory = inventoryRepository.findByStoreIdAndIngredientId(storeId, ingredient.getId());
        if (inventory.isPresent() && inventory.get().getCurrentQty().signum() > 0) {
            throw new RuntimeException(name + " 재고가 남아 있어 삭제할 수 없습니다.");
        }
    }

    private List<Map<String, Object>> ingredients(List<Map<String, Object>> items, Context ctx, Long menuId) {
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Map<String, Object> item : items) {
            String name = text(item.get("name"));
            if (name == null) throw new RuntimeException("식자재 이름이 필요합니다.");
            if (!seen.add(normalizeName(name))) throw new RuntimeException(name + "이(가) 두 번 들어 있습니다.");
            Object qtyValue = item.containsKey("qtyPerUnit") ? item.get("qtyPerUnit") : item.get("qty");
            double qty = qtyValue == null ? 0 : ((Number) qtyValue).doubleValue();
            if (!(qty > 0)) throw new RuntimeException(name + " 사용량은 0보다 커야 합니다.");
            String unit = text(item.get("unit"));
            if (unit == null) throw new RuntimeException(name + " 단위가 필요합니다.");

            Ingredient existing = ctx.findIngredient(name);
            String baseUnit = existing != null ? existing.getUnit() : baseUnitOf(unit);
            if (!compatible(unit, baseUnit)) {
                throw new RuntimeException(name + "은(는) " + baseUnit + " 단위 식자재라 " + unit + "(으)로 쓸 수 없습니다.");
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("name", existing != null ? existing.getName() : name);
            row.put("qtyPerUnit", qty);
            row.put("unit", unit);
            row.put("baseUnit", baseUnit);
            row.put("isNew", existing == null);
            row.put("estimated", Boolean.TRUE.equals(item.get("estimated")));
            if (menuId != null && existing != null) {
                ctx.recipes.get(menuId).stream().filter(x -> x.getIngredient().getId().equals(existing.getId())).findFirst()
                        .ifPresent(mi -> row.put("previousQty", mi.getQtyPerUnit() + " " + mi.getUnit()));
            }
            out.add(row);
        }
        return out;
    }

    private List<Map<String, Object>> menuContext(Long storeId) {
        List<Map<String, Object>> menus = new ArrayList<>();
        for (Menu m : menuRepository.findByStoreIdAndIsActiveTrue(storeId)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", m.getId());
            item.put("name", m.getMenuName());
            item.put("price", m.getPrice());
            item.put("recipe", menuIngredientRepository.findByMenuId(m.getId()).stream().map(mi -> Map.<String, Object>of(
                    "ingredientId", mi.getIngredient().getId(), "name", mi.getIngredient().getName(),
                    "qty", mi.getQtyPerUnit(), "unit", mi.getUnit())).toList());
            menus.add(item);
        }
        return menus;
    }

    static String baseUnitOf(String recipeUnit) {
        return switch (recipeUnit) {
            case "g", "kg" -> "kg";
            case "ml", "L" -> "L";
            default -> recipeUnit;
        };
    }

    static boolean compatible(String recipeUnit, String baseUnit) {
        return switch (baseUnit) {
            case "kg" -> recipeUnit.equals("g") || recipeUnit.equals("kg");
            case "L" -> recipeUnit.equals("ml") || recipeUnit.equals("L");
            default -> recipeUnit.equals(baseUnit);
        };
    }

    static String normalizeName(String name) {
        return name.replaceAll("\\s+", "").toLowerCase();
    }

    private static int price(Object value) {
        if (!(value instanceof Number n) || n.intValue() < 0) throw new RuntimeException("가격은 0원 이상이어야 합니다.");
        return n.intValue();
    }

    private static String text(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString().trim();
    }

    private static Long toLong(Object value) {
        return Long.valueOf(value.toString());
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return value == null ? List.of() : (List<Map<String, Object>>) value;
    }

    // 이 매장의 메뉴·레시피·식자재. 같은 요청 안에서 앞선 변경이 뒤 변경에 보이도록 함께 갱신한다
    private final class Context {
        final Long storeId;
        final Map<Long, Menu> menus = new LinkedHashMap<>();
        final Map<Long, List<MenuIngredient>> recipes = new HashMap<>();
        final List<Ingredient> ingredients;
        final Set<Long> stocked = new HashSet<>();

        Context(Long storeId) {
            this.storeId = storeId;
            for (Menu m : menuRepository.findByStoreIdAndIsActiveTrue(storeId)) {
                menus.put(m.getId(), m);
                recipes.put(m.getId(), new ArrayList<>(menuIngredientRepository.findByMenuId(m.getId())));
            }
            ingredients = new ArrayList<>(ingredientRepository.findByStoreIdIncludingLegacy(storeId));
            inventoryRepository.findByStoreId(storeId).forEach(i -> stocked.add(i.getIngredient().getId()));
        }

        Menu menu(Object id) {
            Menu m = id == null ? null : menus.get(toLong(id));
            if (m == null) throw new RuntimeException("이 가맹점의 메뉴가 아닙니다.");
            return m;
        }

        Menu activeMenuByName(String name) {
            String n = normalizeName(name);
            return menus.values().stream().filter(m -> normalizeName(m.getMenuName()).equals(n)).findFirst().orElse(null);
        }

        Ingredient ingredient(Object id) {
            Long ingredientId = id == null ? null : toLong(id);
            return ingredients.stream().filter(i -> i.getId().equals(ingredientId)).findFirst()
                    .orElseThrow(() -> new RuntimeException("이 가맹점의 식자재가 아닙니다."));
        }

        // 같은 이름이 여럿이면 이 매장 전용 > 이 매장 재고에 있는 것 > 처음 것
        Ingredient findIngredient(String name) {
            String n = normalizeName(name);
            List<Ingredient> same = ingredients.stream().filter(i -> normalizeName(i.getName()).equals(n)).toList();
            if (same.isEmpty()) return null;
            return same.stream().filter(i -> i.getStore() != null).findFirst()
                    .or(() -> same.stream().filter(i -> stocked.contains(i.getId())).findFirst())
                    .orElse(same.get(0));
        }

        void addIngredient(Ingredient ingredient) {
            ingredients.add(ingredient);
        }

        void removeIngredient(Long id) {
            ingredients.removeIf(i -> i.getId().equals(id));
        }

        List<String> menusUsing(Long ingredientId) {
            List<String> names = new ArrayList<>();
            recipes.forEach((menuId, recipe) -> {
                if (recipe.stream().anyMatch(mi -> mi.getIngredient().getId().equals(ingredientId))) {
                    names.add(menus.get(menuId).getMenuName());
                }
            });
            return names;
        }
    }
}
