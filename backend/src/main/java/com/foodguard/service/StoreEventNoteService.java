package com.foodguard.service;

import com.foodguard.entity.SalesData;
import com.foodguard.entity.StoreEventNote;
import com.foodguard.repository.SalesDataRepository;
import com.foodguard.repository.StoreEventNoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * 점주 특이사항: 저장할 때 AI 서비스(/api/events/parse, claude CLI)가 메모를 유형·증감 배율로 바꾸고 함께 저장한다.
 * 배율은 다음 수요 예측 때 XGBoost 의 피처로만 쓰인다 (예측에 직접 곱하지 않음).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StoreEventNoteService {

    // claude 가 인원·수량을 배율로 바꿀 때 비교할 '평소 하루 판매량'을 잴 최근 영업일 수
    private static final int USUAL_SALES_DAYS = 28;

    private final StoreEventNoteRepository storeEventNoteRepository;
    private final SalesDataRepository salesDataRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Transactional
    public StoreEventNote create(Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        LocalDate eventDate = LocalDate.parse(body.get("eventDate").toString());
        String note = body.get("note") != null ? body.get("note").toString().trim() : "";
        if (note.isEmpty()) {
            throw new RuntimeException("특이사항 내용을 입력하세요.");
        }

        Map<String, Object> request = new HashMap<>();
        request.put("note", note);
        request.put("eventDate", eventDate.toString());
        request.put("usualDailySales", usualDailySales(storeId));
        Map<?, ?> parsed;
        try {
            parsed = restTemplate.postForObject(aiServiceUrl + "/api/events/parse", request, Map.class);
        } catch (RestClientException e) {
            log.warn("특이사항 분석 실패 (store {}): {}", storeId, e.getMessage());
            throw new RuntimeException("특이사항을 분석하지 못했습니다. AI 서비스와 claude CLI 로그인 상태를 확인하세요.");
        }

        StoreEventNote saved = new StoreEventNote();
        saved.setStoreId(storeId);
        saved.setEventDate(eventDate);
        saved.setNote(note);
        saved.setEventType((String) parsed.get("eventType"));
        saved.setEventLift(new BigDecimal(parsed.get("lift").toString()));
        saved.setReason((String) parsed.get("reason"));
        return storeEventNoteRepository.save(saved);
    }

    public List<StoreEventNote> getByStore(Long storeId) {
        return storeEventNoteRepository.findByStoreIdOrderByEventDateDesc(storeId);
    }

    @Transactional
    public void delete(Long id) {
        storeEventNoteRepository.deleteById(id);
    }

    // 최근 판매가 있는 영업일 USUAL_SALES_DAYS 개의 하루 평균 매장 전체 판매량. 판매 기록이 없으면 null
    private Double usualDailySales(Long storeId) {
        Map<LocalDate, Integer> byDay = new TreeMap<>(Comparator.reverseOrder());
        for (SalesData s : salesDataRepository.findByStoreIdAndIsDeletedFalse(storeId)) {
            byDay.merge(s.getSaleDate(), s.getQuantity(), Integer::sum);
        }
        return byDay.values().stream().limit(USUAL_SALES_DAYS).mapToInt(Integer::intValue).average().stream()
                .boxed().findFirst().orElse(null);
    }
}
