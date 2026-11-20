package com.foodguard;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.foodguard.entity.*;
import com.foodguard.repository.*;
import com.foodguard.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * 메모리 H2 위에서 Spring 전체를 띄우는 통합 테스트의 기반 (DEV_ROADMAP Q-1).
 * 트랜잭션을 걸지 않는다: 제안 실행의 REQUIRES_NEW 와 롤백을 실제로 보려면 데이터가 커밋돼 있어야 한다.
 * 테스트끼리 섞이지 않도록 테스트마다 새 매장·계정을 만든다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@ContextConfiguration(initializers = IntegrationTest.H2Only.class)
public abstract class IntegrationTest {

    /** DB 연결 전에 실행된다. create-drop 이 공용 DB 에 닿는 일을 막는 마지막 안전장치다. */
    public static class H2Only implements ApplicationContextInitializer<ConfigurableApplicationContext> {
        @Override
        public void initialize(ConfigurableApplicationContext context) {
            assertInMemoryH2(context.getEnvironment().getProperty("spring.datasource.url"));
        }
    }

    public static void assertInMemoryH2(String url) {
        if (url == null || !url.startsWith("jdbc:h2:mem:")) {
            throw new IllegalStateException("통합 테스트는 메모리 H2 에서만 실행합니다. 데이터소스를 확인하세요.");
        }
    }

    private static final AtomicLong SEQ = new AtomicLong();

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected JwtUtil jwt;
    @Autowired protected JdbcTemplate jdbc;
    @Autowired protected UserRepository users;
    @Autowired protected StoreRepository stores;
    @Autowired protected IngredientRepository ingredients;
    @Autowired protected InventoryRepository inventories;
    @Autowired protected InventoryLotRepository lots;
    @Autowired protected InventoryTxnRepository txns;
    @Autowired protected MenuRepository menus;
    @Autowired protected MenuIngredientRepository recipes;
    @Autowired protected OrderRequestRepository orders;

    // ── 픽스처 ───────────────────────────────────────────────────────

    protected User user(String role) {
        User u = new User();
        u.setEmail(role.toLowerCase() + SEQ.incrementAndGet() + "@test.local");
        u.setPassword("x");
        u.setRole(role);
        return users.save(u);
    }

    protected Store store(User owner) {
        Store s = new Store();
        s.setStoreName("매장" + SEQ.incrementAndGet());
        s.setRegion("경남");
        s.setOpenedAt(LocalDate.of(2026, 1, 1));
        s.setUser(owner);
        return stores.save(s);
    }

    /** 보관일수는 앱에서 쓰지 않는 컬럼이라 SQL 로 넣는다. */
    protected Ingredient ingredient(String unit, Integer shelfLifeDays) {
        Ingredient i = new Ingredient();
        i.setName("식자재" + SEQ.incrementAndGet());
        i.setUnit(unit);
        i = ingredients.save(i);
        if (shelfLifeDays != null) {
            jdbc.update("UPDATE INGREDIENT SET shelf_life_days = ? WHERE ingredient_id = ?", shelfLifeDays, i.getId());
            return ingredients.findById(i.getId()).orElseThrow();
        }
        return i;
    }

    protected Inventory stock(Store s, Ingredient i, double qty) {
        Inventory inv = new Inventory();
        inv.setStore(s);
        inv.setIngredient(i);
        inv.setQuantity(qty);
        inv.setMinThreshold(BigDecimal.ONE);
        inv.setUnit(i.getUnit());
        return inventories.save(inv);
    }

    /** 유통기한이 오늘 기준 daysLeft 일 남은 로트. daysLeft == null 이면 기한 없음. */
    protected InventoryLot lot(Store s, Ingredient i, double qty, Integer daysLeft) {
        InventoryLot l = new InventoryLot();
        l.setStoreId(s.getId());
        l.setIngredientId(i.getId());
        l.setReceivedQty(BigDecimal.valueOf(qty));
        l.setRemainingQty(BigDecimal.valueOf(qty));
        l.setReceivedAt(LocalDateTime.now().minusDays(1));
        l.setExpiryDate(daysLeft != null ? LocalDate.now().plusDays(daysLeft) : null);
        return lots.save(l);
    }

    protected Menu menu(Store s) {
        Menu m = new Menu();
        m.setStore(s);
        m.setMenuName("메뉴" + SEQ.incrementAndGet());
        m.setPrice(10000);
        return menus.save(m);
    }

    protected MenuIngredient recipe(Menu m, Ingredient i, double qty, String unit) {
        MenuIngredient mi = new MenuIngredient();
        mi.setMenu(m);
        mi.setIngredient(i);
        mi.setQtyPerUnit(BigDecimal.valueOf(qty));
        mi.setUnit(unit);
        return recipes.save(mi);
    }

    // ── HTTP (실제 JWT 로 필터·권한 검사를 그대로 탄다) ─────────────────

    protected String tokenOf(User u) {
        return "Bearer " + jwt.generateToken(u.getEmail(), u.getRole(), u.getId());
    }

    protected ResultActions call(MockHttpServletRequestBuilder req, User as) throws Exception {
        return mvc.perform(as != null ? req.header("Authorization", tokenOf(as)) : req);
    }

    protected ResultActions getAs(User as, String url) throws Exception {
        return call(get(url), as);
    }

    protected ResultActions postAs(User as, String url, Object body) throws Exception {
        return call(post(url).contentType("application/json").content(json.writeValueAsString(body)), as);
    }

    protected ResultActions putAs(User as, String url, Object body) throws Exception {
        return call(put(url).contentType("application/json").content(json.writeValueAsString(body)), as);
    }

    protected ResultActions deleteAs(User as, String url) throws Exception {
        return call(delete(url), as);
    }
}
