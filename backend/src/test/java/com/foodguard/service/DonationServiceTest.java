package com.foodguard.service;

import com.foodguard.entity.DonationRecord;
import com.foodguard.entity.Inventory;
import com.foodguard.repository.DonationRecordRepository;
import com.foodguard.repository.InventoryRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// DB 없이 기부 등록의 수량 검사(재고 - 이미 기부 예정인 양)만 검증
class DonationServiceTest {

    private static final long STORE_ID = 1L;
    private static final long INGREDIENT_ID = 100L;

    private final DonationRecordRepository donationRecordRepository = mock(DonationRecordRepository.class);
    private final InventoryRepository inventoryRepository = mock(InventoryRepository.class);
    private final DonationService service = new DonationService(donationRecordRepository, inventoryRepository);

    @Test
    void 이미_기부_예정인_양을_뺀_재고까지만_등록된다() {
        Inventory inv = new Inventory();
        inv.setCurrentQty(new BigDecimal("10"));
        when(inventoryRepository.findByStoreIdAndIngredientId(STORE_ID, INGREDIENT_ID)).thenReturn(Optional.of(inv));
        when(donationRecordRepository.findByStoreIdAndStatus(STORE_ID, "PLANNED"))
                .thenReturn(List.of(planned(INGREDIENT_ID, "6")));
        when(donationRecordRepository.save(any())).thenAnswer(a -> a.getArgument(0));

        // 재고 10 중 6 은 이미 기부 예정 → 남은 4 까지만
        assertThat(service.create(STORE_ID, body(4)).getQuantity()).isEqualByComparingTo("4");
        assertThatThrownBy(() -> service.create(STORE_ID, body(5))).hasMessageContaining("기부 가능 수량(4.0)");
        assertThatThrownBy(() -> service.create(STORE_ID, body(0))).hasMessageContaining("0보다 커야");
    }

    @Test
    void 기부_예정량은_식자재별로_합산한다() {
        Map<Long, Double> sums = DonationService.plannedByIngredient(List.of(
                planned(1L, "2"), planned(1L, "3"), planned(2L, "1"), planned(null, "9")));
        assertThat(sums).containsEntry(1L, 5.0).containsEntry(2L, 1.0).hasSize(2);
    }

    private static Map<String, Object> body(double quantity) {
        return Map.of("donationType", "INGREDIENT", "orgName", "푸드뱅크", "orgType", "FOOD_BANK",
                "ingredientId", INGREDIENT_ID, "quantity", quantity);
    }

    private static DonationRecord planned(Long ingredientId, String qty) {
        DonationRecord d = new DonationRecord();
        d.setIngredientId(ingredientId);
        d.setQuantity(new BigDecimal(qty));
        d.setStatus("PLANNED");
        return d;
    }
}
