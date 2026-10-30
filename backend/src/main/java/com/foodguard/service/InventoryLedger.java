package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.InventoryTxn;
import com.foodguard.entity.Store;
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
import java.time.LocalDateTime;
import java.util.List;

/**
 * 재고 변경의 유일한 입구 (DEV_ROADMAP D-2). 재고 행 갱신과 원장 1행 기록을 같은 트랜잭션에서 한다.
 *
 * INVENTORY_TXN 테이블이 없으면(003 마이그레이션 전) 재고만 갱신하고 원장은 건너뛴다.
 * 테이블 유무는 기동 시 한 번 확인하므로, 마이그레이션 후에는 서버를 재시작해야 기록이 시작된다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryLedger {

    private final InventoryRepository inventoryRepository;
    private final InventoryTxnRepository txnRepository;
    private final JdbcTemplate jdbcTemplate;

    private boolean enabled;

    @PostConstruct
    void detectTable() {
        try {
            jdbcTemplate.queryForList("SELECT 1 FROM INVENTORY_TXN WHERE 1 = 0");
            enabled = true;
        } catch (DataAccessException e) {
            enabled = false;
            log.warn("INVENTORY_TXN 테이블이 없어 재고 원장 기록을 건너뜁니다 (003_inventory_txn.sql 적용 후 재시작).");
        }
    }

    public boolean isEnabled() {
        return enabled;
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

    /** 재고 행을 지우기 직전에 0 으로 내리는 원장 행을 남긴다 (행 삭제는 호출 쪽이 한다). */
    @Transactional
    public void recordRemoval(List<Inventory> rows, String refType, Long refId) {
        for (Inventory inv : rows) {
            double cur = inv.getCurrentQty().doubleValue();
            if (cur != 0) record(inv, -cur, 0.0, "ADJUST", refType, refId);
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
        if (delta != 0) record(saved, delta, newQty, reason, refType, refId);
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

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof AuthUser u ? u.id() : null;
    }
}
