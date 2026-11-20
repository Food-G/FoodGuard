package com.foodguard.service;

import com.foodguard.entity.Reservation;
import com.foodguard.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

// 매장 예약: 등록과 상태 변경(방문완료·취소)만 한다
@Service
@RequiredArgsConstructor
public class ReservationService {

    static final Set<String> STATUSES = Set.of("RESERVED", "VISITED", "CANCELLED");

    private final ReservationRepository reservationRepository;

    // from 날짜 이후 예약 (날짜·시간 순)
    public List<Reservation> getByStore(Long storeId, LocalDate from) {
        return reservationRepository.findByStoreIdAndReservationDateGreaterThanEqualOrderByReservationDateAscReservationTimeAsc(storeId, from);
    }

    // body: {storeId, customerName, phone, reservationDate "yyyy-MM-dd", reservationTime "HH:mm", guests, note}
    @Transactional
    public Reservation create(Map<String, Object> body) {
        String name = text(body.get("customerName"));
        if (name == null) throw new RuntimeException("예약자 이름을 입력하세요.");
        if (body.get("reservationDate") == null || body.get("reservationTime") == null) throw new RuntimeException("예약 날짜와 시간을 입력하세요.");
        int guests = body.get("guests") == null ? 0 : Integer.parseInt(body.get("guests").toString());
        if (guests < 1) throw new RuntimeException("인원은 1명 이상이어야 합니다.");

        Reservation r = new Reservation();
        r.setStoreId(Long.parseLong(body.get("storeId").toString()));
        r.setCustomerName(name);
        r.setPhone(text(body.get("phone")));
        r.setReservationDate(LocalDate.parse(body.get("reservationDate").toString()));
        r.setReservationTime(LocalTime.parse(body.get("reservationTime").toString()));
        r.setGuests(guests);
        r.setNote(text(body.get("note")));
        return reservationRepository.save(r);
    }

    @Transactional
    public Reservation updateStatus(Long id, String status) {
        if (status == null || !STATUSES.contains(status)) throw new RuntimeException("예약 상태가 올바르지 않습니다.");
        Reservation r = reservationRepository.findById(id).orElseThrow(() -> new RuntimeException("예약을 찾을 수 없습니다."));
        r.setStatus(status);
        return reservationRepository.save(r);
    }

    // 빈 문자열은 null
    private static String text(Object v) {
        if (v == null) return null;
        String s = v.toString().trim();
        return s.isEmpty() ? null : s;
    }
}
