package com.foodguard.service;

import com.foodguard.entity.*;
import com.foodguard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/** 기부 등록·완료 안전 규칙 (DB·Spring 컨텍스트 없음). */
class DonationServiceTest {

    private static final Long STORE = 60006L;

    private DonationRecordRepository donationRepo;
    private DonationOrgRepository orgRepo;
    private InventoryLotRepository lotRepo;
    private InventoryLedger ledger;
    private DonationService service;
    private Store store;
    private Ingredient lettuce;

    @BeforeEach
    void setUp() {
        donationRepo = mock(DonationRecordRepository.class);
        orgRepo = mock(DonationOrgRepository.class);
        lotRepo = mock(InventoryLotRepository.class);
        ledger = mock(InventoryLedger.class);
        StoreRepository storeRepo = mock(StoreRepository.class);
        IngredientRepository ingRepo = mock(IngredientRepository.class);
        InventoryRepository invRepo = mock(InventoryRepository.class);
        service = new DonationService(donationRepo, orgRepo, storeRepo, ingRepo, invRepo, lotRepo, ledger, mock(JdbcTemplate.class));

        store = new Store();
        store.setId(STORE);
        store.setRegion("경남 창원시");
        lettuce = new Ingredient();
        lettuce.setId(1L);
        lettuce.setName("양상추");
        lettuce.setUnit("kg");
        when(storeRepo.findById(STORE)).thenReturn(Optional.of(store));
        when(ingRepo.findById(1L)).thenReturn(Optional.of(lettuce));
        when(ledger.isLotsEnabled()).thenReturn(true);
        when(donationRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Inventory inv = new Inventory();
        inv.setQuantity(10.3);
        when(invRepo.findByStoreIdAndIngredientId(STORE, 1L)).thenReturn(Optional.of(inv));
    }

    private void lots(Object[]... qtyAndDaysLeft) {
        List<InventoryLot> lots = java.util.Arrays.stream(qtyAndDaysLeft).map(a -> {
            InventoryLot l = new InventoryLot();
            l.setRemainingQty(BigDecimal.valueOf((Double) a[0]));
            l.setExpiryDate(a[1] != null ? LocalDate.now().plusDays((Integer) a[1]) : null);
            return l;
        }).toList();
        when(lotRepo.findOpenFifo(STORE, 1L)).thenReturn(lots);
    }

    private static Object[] lot(double qty, Integer daysLeft) {
        return new Object[]{qty, daysLeft};
    }

    private DonationRecord create(double qty) {
        return service.create(STORE, 1L, qty, "INGREDIENT", "[예시] 가상 푸드뱅크", "FOOD_BANK", null, null);
    }

    private DonationRecord planned(double qty) {
        DonationRecord d = new DonationRecord();
        d.setId(9L);
        d.setStoreId(STORE);
        d.setIngredientId(1L);
        d.setQuantity(BigDecimal.valueOf(qty));
        d.setStatus("PLANNED");
        when(donationRepo.findById(9L)).thenReturn(Optional.of(d));
        return d;
    }

    @Test
    void createIsPlannedAndDoesNotTouchStock() {
        lots(lot(5.0, 2));
        DonationRecord d = create(4.0);
        assertEquals("PLANNED", d.getStatus());
        assertEquals("양상추", d.getIngredientName());
        verify(ledger, never()).set(any(), any(), anyDouble(), any(), any(), any());
    }

    @Test
    void cannotDonateWhileExpiredOrTodayStockRemains() {
        for (int daysLeft : new int[]{-1, 0}) {
            lots(lot(1.0, daysLeft), lot(5.0, 3));
            assertThrows(IllegalStateException.class, () -> create(1.0));
        }
        verify(donationRepo, never()).save(any());
    }

    @Test
    void cannotDonateMoreThanDatedStock() {
        lots(lot(2.0, 3), lot(50.0, null));   // 기한을 모르는 재고는 기부 가능량이 아니다
        assertThrows(IllegalStateException.class, () -> create(2.5));
        assertEquals("PLANNED", create(2.0).getStatus());
    }

    @Test
    void alreadyPlannedDonationsCountAgainstStock() {
        lots(lot(5.0, 3));
        DonationRecord existing = new DonationRecord();
        existing.setQuantity(BigDecimal.valueOf(4.0));
        when(donationRepo.findByStoreIdAndIngredientIdAndStatus(STORE, 1L, "PLANNED")).thenReturn(List.of(existing));
        assertThrows(IllegalStateException.class, () -> create(2.0));
        assertEquals("PLANNED", create(1.0).getStatus());
    }

    @Test
    void refusesWithoutLotTable() {
        when(ledger.isLotsEnabled()).thenReturn(false);
        assertThrows(IllegalStateException.class, () -> create(1.0));
    }

    @Test
    void rejectsBadInput() {
        lots(lot(5.0, 3));
        assertThrows(IllegalStateException.class, () -> create(0));
        assertThrows(IllegalStateException.class, () -> service.create(STORE, 1L, 1, "CASH", "기관", "FOOD_BANK", null, null));
        assertThrows(IllegalStateException.class, () -> service.create(STORE, 1L, 1, "FOOD", "기관", "BANK", null, null));
        assertThrows(IllegalStateException.class, () -> service.create(STORE, 1L, 1, "FOOD", " ", "FOOD_BANK", null, null));
    }

    @Test
    void completeDeductsStockThroughLedgerOnce() {
        lots(lot(5.0, 2));
        DonationRecord d = planned(2.1);

        service.complete(9L);

        assertEquals("COMPLETED", d.getStatus());
        assertNotNull(d.getDonatedAt());
        verify(ledger).set(store, lettuce, 8.2, "DONATION", "DONATION", 9L);
        assertThrows(IllegalStateException.class, () -> service.complete(9L));
        verify(ledger, times(1)).set(any(), any(), anyDouble(), any(), any(), anyLong());
    }

    @Test
    void completeIsBlockedIfStockExpiredAfterPlanning() {
        lots(lot(5.0, 0));
        DonationRecord d = planned(2.0);
        assertThrows(IllegalStateException.class, () -> service.complete(9L));
        assertEquals("PLANNED", d.getStatus());
        verify(ledger, never()).set(any(), any(), anyDouble(), any(), any(), any());
    }

    @Test
    void cancelOnlyFromPlannedAndKeepsStock() {
        DonationRecord d = planned(2.0);
        service.cancel(9L);
        assertEquals("CANCELLED", d.getStatus());
        assertThrows(IllegalStateException.class, () -> service.cancel(9L));
        verify(ledger, never()).set(any(), any(), anyDouble(), any(), any(), any());
    }

    @Test
    void orgMatchingUsesRegionContainmentAndCategory() {
        DonationOrg org = new DonationOrg();
        org.setRegion("경남");
        org.setAcceptsCategories("채소류, 빵류");
        assertTrue(DonationService.matches(org, "경남 창원시", "빵류"));
        assertTrue(DonationService.matches(org, "경남", null));
        assertFalse(DonationService.matches(org, "서울", "빵류"));
        assertFalse(DonationService.matches(org, "경남", "유제품"));
        assertFalse(DonationService.matches(org, "", "빵류"));
        org.setAcceptsCategories(null);
        assertTrue(DonationService.matches(org, "경남", "유제품"));
    }

    @Test
    void proposalCreatesPlannedDonationForListedOrg() {
        lots(lot(5.0, 3));
        DonationOrg org = new DonationOrg();
        org.setOrgName("[예시] 가상 푸드뱅크 경남");
        org.setOrgType("FOOD_BANK");
        when(orgRepo.findById(3L)).thenReturn(Optional.of(org));
        when(donationRepo.save(any())).thenAnswer(inv -> {
            DonationRecord d = inv.getArgument(0);
            d.setId(9L);
            return d;
        });
        AgentProposal p = new AgentProposal();
        p.setId(5L);
        p.setType("DONATION_CREATE");
        p.setStoreId(STORE);
        p.setPayload(Map.of("ingredientId", 1, "quantity", 4.0, "donationType", "INGREDIENT", "orgId", 3));

        Map<String, Object> result = new ProposalExecutor(mock(OrderRequestService.class), mock(NotificationService.class),
                mock(WasteService.class), service, lotRepo, mock(RestTemplate.class)).execute(p);

        assertEquals(9L, result.get("donationId"));
        verify(donationRepo).save(argThat(d -> "[예시] 가상 푸드뱅크 경남".equals(d.getOrgName())));
    }

    @Test
    void inactiveOrgFailsProposal() {
        DonationOrg org = new DonationOrg();
        org.setActive(false);
        when(orgRepo.findById(3L)).thenReturn(Optional.of(org));
        assertThrows(IllegalStateException.class,
                () -> service.createForOrg(STORE, 1L, 1.0, "INGREDIENT", 3L, null));
    }
}
