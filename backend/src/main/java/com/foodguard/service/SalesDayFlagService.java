package com.foodguard.service;

import com.foodguard.entity.SalesDayFlag;
import com.foodguard.repository.SalesDayFlagRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SalesDayFlagService {

    private final SalesDayFlagRepository salesDayFlagRepository;

    // 같은 날 같은 기록이 이미 있으면 그대로 반환
    @Transactional
    public SalesDayFlag create(Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        LocalDate flagDate = LocalDate.parse(body.get("flagDate").toString());
        String flagType = body.get("flagType").toString();

        Long menuId;
        if ("CLOSED".equals(flagType)) {
            menuId = null;
        } else if ("SOLD_OUT".equals(flagType)) {
            if (body.get("menuId") == null) {
                throw new RuntimeException("품절 기록에는 메뉴가 필요합니다.");
            }
            menuId = Long.parseLong(body.get("menuId").toString());
        } else {
            throw new RuntimeException("flagType 은 CLOSED 또는 SOLD_OUT 이어야 합니다.");
        }

        return salesDayFlagRepository
                .findByStoreIdAndMenuIdAndFlagDateAndFlagType(storeId, menuId, flagDate, flagType)
                .orElseGet(() -> {
                    SalesDayFlag flag = new SalesDayFlag();
                    flag.setStoreId(storeId);
                    flag.setMenuId(menuId);
                    flag.setFlagDate(flagDate);
                    flag.setFlagType(flagType);
                    return salesDayFlagRepository.save(flag);
                });
    }

    public List<SalesDayFlag> getByStore(Long storeId) {
        return salesDayFlagRepository.findByStoreIdOrderByFlagDateDesc(storeId);
    }

    @Transactional
    public void delete(Long id) {
        salesDayFlagRepository.deleteById(id);
    }
}
