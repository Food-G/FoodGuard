package com.foodguard.service;

import com.foodguard.entity.Reservation;
import com.foodguard.repository.ReservationRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// DB 없이 예약 등록·상태 변경 규칙만 검증
class ReservationServiceTest {

    private final ReservationRepository repo = mock(ReservationRepository.class);
    private final ReservationService service = new ReservationService(repo);

    private Map<String, Object> body() {
        Map<String, Object> b = new HashMap<>();
        b.put("storeId", 1);
        b.put("customerName", " 홍길동 ");
        b.put("phone", "");
        b.put("reservationDate", "2026-11-21");
        b.put("reservationTime", "18:30");
        b.put("guests", 4);
        return b;
    }

    @Test
    void 등록하면_예약중_상태로_저장되고_빈_값은_null() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Reservation r = service.create(body());

        assertThat(r.getStatus()).isEqualTo("RESERVED");
        assertThat(r.getCustomerName()).isEqualTo("홍길동");
        assertThat(r.getPhone()).isNull();
        assertThat(r.getReservationDate()).isEqualTo(LocalDate.of(2026, 11, 21));
        assertThat(r.getReservationTime()).isEqualTo(LocalTime.of(18, 30));
    }

    @Test
    void 이름이_없거나_인원이_0이면_거부한다() {
        Map<String, Object> noName = body();
        noName.put("customerName", " ");
        Map<String, Object> noGuests = body();
        noGuests.put("guests", 0);
        Map<String, Object> noTime = body();
        noTime.remove("reservationTime");

        assertThatThrownBy(() -> service.create(noName)).hasMessageContaining("이름");
        assertThatThrownBy(() -> service.create(noGuests)).hasMessageContaining("인원");
        assertThatThrownBy(() -> service.create(noTime)).hasMessageContaining("시간");
        verify(repo, never()).save(any());
    }

    @Test
    void 상태는_정해진_값만_받는다() {
        Reservation r = new Reservation();
        when(repo.findById(5L)).thenReturn(Optional.of(r));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThat(service.updateStatus(5L, "VISITED").getStatus()).isEqualTo("VISITED");
        assertThatThrownBy(() -> service.updateStatus(5L, "DONE")).hasMessageContaining("상태");
        assertThatThrownBy(() -> service.updateStatus(5L, null)).hasMessageContaining("상태");
    }
}
