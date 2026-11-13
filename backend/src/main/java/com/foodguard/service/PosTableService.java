package com.foodguard.service;

import com.foodguard.entity.PosTable;
import com.foodguard.repository.PosTableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

// POS 테이블 배치: 화면의 배치 전체를 한 번에 저장한다
@Service
@RequiredArgsConstructor
public class PosTableService {

    private final PosTableRepository posTableRepository;

    public List<PosTable> getByStore(Long storeId) {
        return posTableRepository.findByStoreIdOrderByIdAsc(storeId);
    }

    // body: [{name, x, y, w, h, seats}, ...]
    @Transactional
    public List<PosTable> replace(Long storeId, List<Map<String, Object>> body) {
        List<PosTable> tables = new ArrayList<>();
        for (Map<String, Object> m : body) {
            int seats = toInt(m.get("seats"));
            if (seats < 1) throw new RuntimeException("좌석 수는 1 이상이어야 합니다.");
            String name = m.get("name") == null ? "" : m.get("name").toString().trim();
            if (name.isEmpty()) throw new RuntimeException("테이블 이름을 입력하세요.");
            PosTable t = new PosTable();
            t.setStoreId(storeId);
            t.setName(name);
            t.setX(toInt(m.get("x")));
            t.setY(toInt(m.get("y")));
            t.setW(toInt(m.get("w")));
            t.setH(toInt(m.get("h")));
            t.setSeats(seats);
            tables.add(t);
        }
        posTableRepository.deleteByStoreId(storeId);
        posTableRepository.flush();
        return posTableRepository.saveAll(tables);
    }

    private static int toInt(Object v) {
        return (int) Math.round(Double.parseDouble(String.valueOf(v)));
    }
}
