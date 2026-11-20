package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.InventoryLot;
import com.foodguard.entity.InventoryTxn;
import com.foodguard.entity.Store;
import com.foodguard.repository.InventoryLotRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.InventoryTxnRepository;
import com.foodguard.security.AuthUser;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * 재고 변경의 유일한 입구 (DEV_ROADMAP D-2, D-3). 재고 행 갱신, 원장 1행, 로트 동기화를 같은 트랜잭션에서 한다.
 *
 * 재고 행(current_qty)이 진실이다. 로트는 변경 후 합계를 재고에 맞춘다:
 *   - 발주 입고(ORDER_DONE): 새 로트 (유통기한 = 입고일 + 식자재 보관일수, 보관일수 없으면 NULL)
 *   - 합계 > 재고: 유통기한 이른 로트부터 깎는다 (FIFO — 판매·폐기·기부·하향 조정)
 *   - 합계 < 재고: 유통기한 NULL 보정 로트를 만든다 (수동 상향 조정·초기화)
 *
 * INVENTORY_TXN / INVENTORY_LOT 테이블이 없으면(003/004 마이그레이션 전) 해당 기록만 건너뛴다.
 * 테이블 유무는 기동 시 한 번 확인하므로, 마이그레이션 후에는 서버를 재시작해야 기록이 시작된다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryLedger {

    /** FIFO: 유통기한 이른 것 → 유통기한 없는 것은 마지막, 같으면 먼저 입고된 것. */
    static final Comparator<InventoryLot> FIFO = Comparator
            .comparing(InventoryLot::getExpiryDate, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(InventoryLot::getReceivedAt, Comparator.nullsLast(Comparator.naturalOrder()));

    private final InventoryRepository inventoryRepository;
    private final InventoryTxnRepository txnRepository;
    private final InventoryLotRepository lotRepository;
    private final JdbcTemplate jdbcTemplate;

    private boolean enabled;
    private boolean lotsEnabled;

    @PostConstruct
    void detectTable() {
        enabled = tableExists("INVENTORY_TXN");
        lotsEnabled = tableExists("INVENTORY_LOT");
        if (!enabled) log.warn("INVENTORY_TXN 테이블이 없어 재고 원장 기록을 건너뜁니다 (003_inventory_txn.sql 적용 후 재시작).");
        if (!lotsEnabled) log.warn("INVENTORY_LOT 테이블이 없어 입고 로트 관리를 건너뜁니다 (004_inventory_lot.sql 적용 후 재시작).");
    }

    private boolean tableExists(String table) {
        try {
            jdbcTemplate.queryForList("SELECT 1 FROM " + table + " WHERE 1 = 0");
            return true;
        } catch (DataAccessException e) {
            return false;
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isLotsEnabled() {
        return lotsEnabled;
    }

    /** 재고에 delta 를 더한다 (+입고 −소모). 재고 행이 없으면 0 에서 시작해 만든다. */
    @Transactional
    public Inventory apply(Store store, Ingredient ingredient, double delta,
                           String reason, String refType, Long refId) {
        Inventory inv = findOrNew(store, ingredient);
        return write(inv, inv.getCurrentQty().doubleValue() + delta, delta, reason, refType, refId);
    }

    /** 재고를 newQty 로 맞춘다 (수동 조정·초기화·반올림한 차감). 원장에는 차이만큼 기록한다. */
    @Transactional
    public Inventory set(Store store, Ingredient ingredient, double newQty,
                         String reason, String refType, Long refId) {
        Inventory inv = findOrNew(store, ingredient);
        return write(inv, newQty, newQty - inv.getCurrentQty().doubleValue(), reason, refType, refId);
    }

    /** 재고 행을 지우기 직전에 0 으로 내리는 원장 행을 남기고 로트를 비운다 (행 삭제는 호출 쪽이 한다). */
    @Transactional
    public void recordRemoval(List<Inventory> rows, String refType, Long refId) {
        for (Inventory inv : rows) {
            double cur = inv.getCurrentQty().doubleValue();
            if (cur != 0) record(inv, -cur, 0.0, "ADJUST", refType, refId);
            syncLots(inv, 0.0, 0.0, "ADJUST", refId);
        }
    }

    private Inventory findOrNew(Store store, Ingredient ingredient) {
        return inventoryRepository.findByStoreIdAndIngredientId(store.getId(), ingredient.getId())
                .orElseGet(() -> {
                    Inventory n = new Inventory();
                    n.setStore(store);
                    n.setIngredient(ingredient);
                    n.setQuantity(0.0);
                    n.setMinThreshold(BigDecimal.ZERO);
                    n.setUnit(ingredient.getUnit());
                    return n;
                });
    }

    private Inventory write(Inventory inv, double newQty, double delta,
                            String reason, String refType, Long refId) {
        inv.setQuantity(newQty);
        inv.setUnit(inv.getIngredient().getUnit());
        inv.setUpdatedAt(LocalDateTime.now());
        Inventory saved = inventoryRepository.save(inv);
        if (delta != 0) {
            record(saved, delta, newQty, reason, refType, refId);
            syncLots(saved, newQty, delta, reason, refId);
        }
        return saved;
    }

    private void record(Inventory inv, double delta, double qtyAfter,
                        String reason, String refType, Long refId) {
        if (!enabled) return;
        InventoryTxn t = new InventoryTxn();
        t.setStoreId(inv.getStore().getId());
        t.setIngredientId(inv.getIngredient().getId());
        t.setDeltaQty(BigDecimal.valueOf(delta));
        t.setQtyAfter(BigDecimal.valueOf(qtyAfter));
        t.setReason(reason);
        t.setRefType(refType);
        t.setRefId(refId);
        t.setCreatedAt(LocalDateTime.now());
        t.setCreatedBy(currentUserId());
        txnRepository.save(t);
    }

    private void syncLots(Inventory inv, double newQty, double delta, String reason, Long refId) {
        if (!lotsEnabled) return;
        Long storeId = inv.getStore().getId();
        Ingredient ing = inv.getIngredient();
        List<InventoryLot> lots = new ArrayList<>(lotRepository.findOpenFifo(storeId, ing.getId()));
        LocalDateTime now = LocalDateTime.now();
        if ("ORDER_DONE".equals(reason) && delta > 0) {
            Integer days = ing.getShelfLifeDays();
            lots.add(newLot(storeId, ing.getId(), refId, qty(delta), now,
                    days != null ? now.toLocalDate().plusDays(days) : null));
        }
        BigDecimal target = qty(Math.max(0.0, newQty));  // 음수 재고(부족분)는 로트 0
        InventoryLot correction = reconcile(lots, target);
        if (correction != null) {
            correction.setStoreId(storeId);
            correction.setIngredientId(ing.getId());
            correction.setReceivedAt(now);
            lots.add(correction);
        }
        lotRepository.saveAll(lots);
    }

    /**
     * 로트 합계를 target 에 맞춘다. 많으면 FIFO 로 깎고(lots 를 직접 수정),
     * 모자라면 채울 보정 로트(유통기한 NULL, 아직 매장·식자재 미지정)를 돌려준다.
     */
    static InventoryLot reconcile(List<InventoryLot> lots, BigDecimal target) {
        lots.sort(FIFO);
        BigDecimal sum = lots.stream().map(InventoryLot::getRemainingQty).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal excess = sum.subtract(target);
        if (excess.signum() > 0) {
            for (InventoryLot l : lots) {
                if (excess.signum() <= 0) break;
                BigDecimal take = l.getRemainingQty().min(excess);
                l.setRemainingQty(l.getRemainingQty().subtract(take));
                excess = excess.subtract(take);
            }
            return null;
        }
        if (excess.signum() < 0) {
            return newLot(null, null, null, excess.negate(), null, null);
        }
        return null;
    }

    private static InventoryLot newLot(Long storeId, Long ingredientId, Long orderId, BigDecimal qty,
                                       LocalDateTime receivedAt, LocalDate expiry) {
        InventoryLot l = new InventoryLot();
        l.setStoreId(storeId);
        l.setIngredientId(ingredientId);
        l.setOrderId(orderId);
        l.setReceivedQty(qty);
        l.setRemainingQty(qty);
        l.setReceivedAt(receivedAt);
        l.setExpiryDate(expiry);
        return l;
    }

    private static BigDecimal qty(double v) {
        return BigDecimal.valueOf(v).setScale(3, RoundingMode.HALF_UP);
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthUser u ? u.id() : null;
    }
}
