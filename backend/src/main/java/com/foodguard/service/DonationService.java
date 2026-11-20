package com.foodguard.service;

import com.foodguard.entity.DonationRecord;
import com.foodguard.entity.Inventory;
import com.foodguard.repository.DonationRecordRepository;
import com.foodguard.repository.InventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DonationService {

    private final DonationRecordRepository donationRecordRepository;
    private final InventoryRepository inventoryRepository;

    @Transactional
    public DonationRecord create(Long storeId, Map<String, Object> body) {
        DonationRecord record = new DonationRecord();
        record.setStoreId(storeId);
        record.setDonationType((String) body.get("donationType"));
        record.setOrgName((String) body.get("orgName"));
        record.setOrgType((String) body.get("orgType"));
        record.setOrgContact((String) body.getOrDefault("orgContact", null));
        record.setDescription((String) body.getOrDefault("description", null));
        record.setStatus("PLANNED");

        if (body.get("ingredientId") != null) {
            record.setIngredientId(((Number) body.get("ingredientId")).longValue());
        }
        if (body.get("ingredientName") != null) {
            record.setIngredientName((String) body.get("ingredientName"));
        }
        if (body.get("quantity") != null) {
            record.setQuantity(BigDecimal.valueOf(((Number) body.get("quantity")).doubleValue()));
        }
        if (body.get("unit") != null) {
            record.setUnit((String) body.get("unit"));
        }

        // 재고에서 이미 기부 예정으로 잡힌 양을 뺀 만큼만 기부할 수 있다 (같은 재고 중복 등록 방지)
        if (record.getIngredientId() != null && record.getQuantity() != null) {
            double qty = record.getQuantity().doubleValue();
            if (qty <= 0) {
                throw new RuntimeException("기부 수량은 0보다 커야 합니다.");
            }
            Inventory inv = inventoryRepository.findByStoreIdAndIngredientId(storeId, record.getIngredientId())
                    .orElseThrow(() -> new RuntimeException("재고에 없는 식자재입니다."));
            double planned = plannedByIngredient(donationRecordRepository.findByStoreIdAndStatus(storeId, "PLANNED"))
                    .getOrDefault(record.getIngredientId(), 0.0);
            double available = inv.getCurrentQty().doubleValue() - planned;
            if (qty > available + 1e-9) {
                throw new RuntimeException("기부 가능 수량(" + Math.max(0, Math.round(available * 10) / 10.0) + ")을 넘었습니다.");
            }
        }

        return donationRecordRepository.save(record);
    }

    // 식자재별 기부 예정(PLANNED) 수량 합계
    static Map<Long, Double> plannedByIngredient(List<DonationRecord> planned) {
        Map<Long, Double> sums = new HashMap<>();
        for (DonationRecord d : planned) {
            if (d.getIngredientId() != null && d.getQuantity() != null) {
                sums.merge(d.getIngredientId(), d.getQuantity().doubleValue(), Double::sum);
            }
        }
        return sums;
    }

    @Transactional
    public DonationRecord complete(Long donationId) {
        DonationRecord record = donationRecordRepository.findById(donationId)
                .orElseThrow(() -> new RuntimeException("기부 기록을 찾을 수 없습니다."));

        if (!"PLANNED".equals(record.getStatus())) {
            throw new RuntimeException("진행 예정 상태인 기부만 완료 처리할 수 있습니다.");
        }

        record.setStatus("COMPLETED");
        record.setDonatedAt(LocalDateTime.now());

        if (record.getIngredientId() != null && record.getQuantity() != null) {
            inventoryRepository.findByStoreIdAndIngredientId(record.getStoreId(), record.getIngredientId())
                    .ifPresent(inv -> {
                        double remaining = inv.getCurrentQty().doubleValue() - record.getQuantity().doubleValue();
                        inv.setCurrentQty(BigDecimal.valueOf(Math.max(0, remaining)));
                        inventoryRepository.save(inv);
                    });
        }

        return donationRecordRepository.save(record);
    }

    @Transactional
    public DonationRecord cancel(Long donationId) {
        DonationRecord record = donationRecordRepository.findById(donationId)
                .orElseThrow(() -> new RuntimeException("기부 기록을 찾을 수 없습니다."));
        // 완료된 기부는 재고가 이미 줄었다. 취소하면 재고와 기록이 어긋난다
        if (!"PLANNED".equals(record.getStatus())) {
            throw new RuntimeException("진행 예정 상태인 기부만 취소할 수 있습니다.");
        }
        record.setStatus("CANCELLED");
        return donationRecordRepository.save(record);
    }

    public List<DonationRecord> getByStore(Long storeId) {
        return donationRecordRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
    }
}
