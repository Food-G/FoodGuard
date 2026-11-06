package com.foodguard.service;

import com.foodguard.entity.DonationOrg;
import com.foodguard.entity.DonationRecord;
import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Inventory;
import com.foodguard.entity.InventoryLot;
import com.foodguard.entity.Store;
import com.foodguard.repository.DonationOrgRepository;
import com.foodguard.repository.DonationRecordRepository;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.InventoryLotRepository;
import com.foodguard.repository.InventoryRepository;
import com.foodguard.repository.StoreRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

/**
 * 기부 (AG-3). 등록은 재고를 바꾸지 않고, 완료할 때 InventoryLedger 로 차감한다.
 *
 * 식품 안전: 기한이 오늘이거나 지난 재고가 남아 있으면 기부를 막는다. 차감이 FIFO 라 그런 재고가 있으면
 * 장부에서는 만료분이 빠지는데 실제로는 멀쩡한 재고가 나가, 만료품이 매장에 남은 채 기록에서 사라진다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DonationService {

    static final Set<String> DONATION_TYPES = Set.of("FOOD", "INGREDIENT");
    static final Set<String> ORG_TYPES = Set.of("ORPHANAGE", "NURSING_HOME", "FOOD_BANK", "OTHER");
    private static final double EPS = 0.005;

    private final DonationRecordRepository donationRepository;
    private final DonationOrgRepository orgRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryLotRepository lotRepository;
    private final InventoryLedger ledger;
    private final JdbcTemplate jdbcTemplate;

    private boolean orgsEnabled;

    @PostConstruct
    void detectTable() {
        try {
            jdbcTemplate.queryForList("SELECT 1 FROM DONATION_ORG WHERE 1 = 0");
            orgsEnabled = true;
        } catch (DataAccessException e) {
            log.warn("DONATION_ORG 테이블이 없어 기부처 목록을 제공하지 않습니다 (008_donation_org.sql 적용 후 재시작).");
        }
    }

    public boolean isOrgsEnabled() {
        return orgsEnabled;
    }

    @Transactional
    public DonationRecord create(Long storeId, Long ingredientId, double quantity, String donationType,
                                 String orgName, String orgType, String orgContact, String description) {
        if (!DONATION_TYPES.contains(donationType)) throw new IllegalStateException("알 수 없는 기부 유형입니다: " + donationType);
        if (!ORG_TYPES.contains(orgType)) throw new IllegalStateException("알 수 없는 기관 유형입니다: " + orgType);
        if (orgName == null || orgName.isBlank()) throw new IllegalStateException("기관명이 필요합니다.");
        double qty = round2(quantity);
        if (qty <= 0) throw new IllegalStateException("기부 수량은 0보다 커야 합니다.");
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new IllegalStateException("식자재를 찾을 수 없습니다: " + ingredientId));

        // 이미 예정된 기부까지 합쳐서 기한 내 재고를 넘지 않게 한다 (같은 재고를 두 번 약속하지 않도록)
        double planned = donationRepository.findByStoreIdAndIngredientIdAndStatus(storeId, ingredientId, "PLANNED").stream()
                .mapToDouble(d -> d.getQuantity().doubleValue()).sum();
        assertDonatable(storeId, ingredient, qty + planned);

        DonationRecord d = new DonationRecord();
        d.setStoreId(storeId);
        d.setIngredientId(ingredientId);
        d.setIngredientName(ingredient.getName());
        d.setUnit(ingredient.getUnit());
        d.setQuantity(BigDecimal.valueOf(qty));
        d.setDonationType(donationType);
        d.setOrgName(orgName);
        d.setOrgType(orgType);
        d.setOrgContact(orgContact);
        d.setDescription(description);
        d.setStatus("PLANNED");
        d.setCreatedAt(LocalDateTime.now());
        return donationRepository.save(d);
    }

    /** 에이전트 제안 승인 경로: 기관 정보를 기부처 목록에서 가져온다. */
    @Transactional
    public DonationRecord createForOrg(Long storeId, Long ingredientId, double quantity, String donationType,
                                       Long orgId, String description) {
        DonationOrg org = orgRepository.findById(orgId)
                .filter(DonationOrg::isActive)
                .orElseThrow(() -> new IllegalStateException("기부처를 찾을 수 없습니다: " + orgId));
        return create(storeId, ingredientId, quantity, donationType,
                org.getOrgName(), org.getOrgType(), org.getContact(), description);
    }

    /** 완료 시점에 재고를 차감한다. 등록 후 기한이 지났으면 막힌다. */
    @Transactional
    public DonationRecord complete(Long id) {
        DonationRecord d = plannedOrThrow(id);
        Store store = storeRepository.findById(d.getStoreId())
                .orElseThrow(() -> new IllegalStateException("가맹점을 찾을 수 없습니다: " + d.getStoreId()));
        Ingredient ingredient = ingredientRepository.findById(d.getIngredientId())
                .orElseThrow(() -> new IllegalStateException("식자재를 찾을 수 없습니다: " + d.getIngredientId()));
        double qty = d.getQuantity().doubleValue();
        assertDonatable(d.getStoreId(), ingredient, qty);
        double current = inventoryRepository.findByStoreIdAndIngredientId(d.getStoreId(), d.getIngredientId())
                .map(Inventory::getCurrentQty).map(BigDecimal::doubleValue).orElse(0.0);

        ledger.set(store, ingredient, round2(current - qty), "DONATION", "DONATION", d.getId());
        d.setStatus("COMPLETED");
        d.setDonatedAt(LocalDateTime.now());
        return donationRepository.save(d);
    }

    @Transactional
    public DonationRecord cancel(Long id) {
        DonationRecord d = plannedOrThrow(id);
        d.setStatus("CANCELLED");
        return donationRepository.save(d);
    }

    public List<DonationRecord> getByStore(Long storeId) {
        return donationRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
    }

    public List<DonationOrg> orgsFor(Long storeId, String category) {
        String region = storeRepository.findById(storeId)
                .orElseThrow(() -> new IllegalStateException("가맹점을 찾을 수 없습니다: " + storeId)).getRegion();
        return orgRepository.findByIsActiveTrue().stream().filter(o -> matches(o, region, category)).toList();
    }

    /** 지역은 표기가 제각각이라(경남 / 경남 창원시) 포함 관계로 본다. accepts_categories NULL = 전체. */
    static boolean matches(DonationOrg org, String storeRegion, String category) {
        boolean sameRegion = storeRegion != null && !storeRegion.isBlank()
                && (storeRegion.contains(org.getRegion()) || org.getRegion().contains(storeRegion));
        if (!sameRegion) return false;
        if (category == null || org.getAcceptsCategories() == null) return true;
        return Arrays.stream(org.getAcceptsCategories().split(",")).map(String::trim).anyMatch(category::equals);
    }

    private void assertDonatable(Long storeId, Ingredient ingredient, double qty) {
        if (!ledger.isLotsEnabled()) {
            throw new IllegalStateException("입고 로트가 아직 적용되지 않아 유통기한을 확인할 수 없습니다 (004_inventory_lot.sql 적용 후 서버 재시작).");
        }
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        double safe = 0;
        for (InventoryLot lot : lotRepository.findOpenFifo(storeId, ingredient.getId())) {
            if (lot.getExpiryDate() == null) continue;  // 기한을 모르는 재고는 기부 가능량에 넣지 않는다
            if (lot.getExpiryDate().isBefore(tomorrow)) {
                throw new IllegalStateException(ingredient.getName() + ": 기한이 오늘이거나 지난 재고가 남아 있습니다. 먼저 폐기 등록하세요.");
            }
            safe += lot.getRemainingQty().doubleValue();
        }
        if (qty > safe + EPS) {
            throw new IllegalStateException(ingredient.getName() + ": 기부할 수 있는 재고는 " + round2(safe) + ingredient.getUnit()
                    + "입니다 (예정된 기부 포함 요청량 " + round2(qty) + ").");
        }
    }

    private DonationRecord plannedOrThrow(Long id) {
        DonationRecord d = donationRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("기부 기록을 찾을 수 없습니다: " + id));
        if (!"PLANNED".equals(d.getStatus())) {
            throw new IllegalStateException("이미 처리된 기부입니다: " + d.getStatus());
        }
        return d;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
