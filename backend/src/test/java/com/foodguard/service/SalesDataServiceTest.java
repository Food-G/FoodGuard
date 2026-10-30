package com.foodguard.service;

import com.foodguard.repository.MenuRepository;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SalesDataServiceTest {

    private final SalesDataRepository salesDataRepository = mock(SalesDataRepository.class);
    private final SalesDataService service = new SalesDataService(
            salesDataRepository, mock(StoreRepository.class), mock(MenuRepository.class));

    @Test
    @DisplayName("주간 매출은 오늘 포함 최근 7일 집계 결과를 {storeId: 금액}으로 바꾼다")
    void weeklyRevenueUsesLastSevenDays() {
        LocalDate today = LocalDate.now();
        when(salesDataRepository.sumRevenueByStore(today.minusDays(6), today))
                .thenReturn(List.of(new Object[]{1L, 150000L}, new Object[]{2L, 98000}));

        Map<Long, Long> result = service.getAllStoreWeeklyRevenue();

        assertThat(result).containsExactly(Map.entry(1L, 150000L), Map.entry(2L, 98000L));
        verify(salesDataRepository).sumRevenueByStore(today.minusDays(6), today);
    }
}
