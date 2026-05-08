package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Store;
import com.foodguard.entity.WasteRecord;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.WasteRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WasteRecordService {

    private final WasteRecordRepository wasteRecordRepository;
    private final StoreRepository storeRepository;
    private final IngredientRepository ingredientRepository;
    private final NotificationService notificationService;

    // 폐기 기록 등록
    @Transactional
    public WasteRecord create(Long storeId, Long ingredientId,
                              Double wasteQty, LocalDate wasteDate, String reason) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Ingredient ingredient = ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new RuntimeException("식자재를 찾을 수 없습니다."));

        WasteRecord record = new WasteRecord();
        record.setStore(store);
        record.setIngredient(ingredient);
        record.setWasteQty(BigDecimal.valueOf(wasteQty));
        record.setWasteDate(wasteDate != null ? wasteDate : LocalDate.now());
        record.setReason(reason);

        WasteRecord saved = wasteRecordRepository.save(record);

        // 폐기 알림 생성
        String message = String.format("[폐기 기록] %s: %.2f%s 폐기 - %s",
                ingredient.getName(), wasteQty, ingredient.getUnit(),
                reason != null ? reason : "사유 없음");
        notificationService.create(storeId, message, "WASTE");

        return saved;
    }

    // 단건 조회
    public WasteRecord getById(Long id) {
        return wasteRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("폐기 기록을 찾을 수 없습니다."));
    }

    // 가맹점별 전체 조회
    public List<WasteRecord> getByStore(Long storeId) {
        return wasteRecordRepository.findByStoreIdOrderByWasteDateDesc(storeId);
    }

    // 기간별 조회
    public List<WasteRecord> getByDateRange(Long storeId, LocalDate start, LocalDate end) {
        return wasteRecordRepository
                .findByStoreIdAndWasteDateBetweenOrderByWasteDateDesc(storeId, start, end);
    }

    // 식자재별 폐기 기록 조회
    public List<WasteRecord> getByIngredient(Long storeId, Long ingredientId) {
        return wasteRecordRepository
                .findByStoreIdAndIngredientIdOrderByWasteDateDesc(storeId, ingredientId);
    }

    // 폐기 기록 수정
    @Transactional
    public WasteRecord update(Long id, Double wasteQty, String reason) {
        WasteRecord record = getById(id);
        if (wasteQty != null) record.setWasteQty(BigDecimal.valueOf(wasteQty));
        if (reason != null) record.setReason(reason);
        return wasteRecordRepository.save(record);
    }

    // 폐기 기록 삭제
    @Transactional
    public String delete(Long id) {
        if (!wasteRecordRepository.existsById(id)) {
            throw new RuntimeException("폐기 기록을 찾을 수 없습니다.");
        }
        wasteRecordRepository.deleteById(id);
        return "폐기 기록 삭제 완료";
    }
}
