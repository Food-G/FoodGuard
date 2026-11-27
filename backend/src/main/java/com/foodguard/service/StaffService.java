package com.foodguard.service;

import com.foodguard.entity.Staff;
import com.foodguard.repository.StaffRepository;
import com.foodguard.repository.StoreRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** 매장 직원 등록·수정·삭제. 테이블(009_staff.sql)이 없으면 isEnabled() = false. */
@Service
@RequiredArgsConstructor
@Slf4j
public class StaffService {

    static final List<String> DAYS = List.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN");
    private static final Pattern TIME = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");

    private final StaffRepository staffRepository;
    private final StoreRepository storeRepository;
    private final JdbcTemplate jdbcTemplate;

    private boolean enabled;

    @PostConstruct
    void detectTable() {
        try {
            jdbcTemplate.queryForList("SELECT 1 FROM STAFF WHERE 1 = 0");
            enabled = true;
        } catch (DataAccessException e) {
            log.warn("STAFF 테이블이 없어 직원 관리 API 를 제공하지 않습니다 (009_staff.sql 적용 후 재시작).");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    public List<Staff> getByStore(Long storeId) {
        return staffRepository.findByStoreIdOrderByIdAsc(storeId);
    }

    @Transactional
    public Staff create(Long storeId, String name, String role, List<String> workDays, String startTime, String endTime) {
        if (!storeRepository.existsById(storeId)) throw new IllegalStateException("가맹점을 찾을 수 없습니다: " + storeId);
        Staff staff = new Staff();
        staff.setStoreId(storeId);
        apply(staff, name, role, workDays, startTime, endTime);
        return staffRepository.save(staff);
    }

    @Transactional
    public Staff update(Long id, String name, String role, List<String> workDays, String startTime, String endTime) {
        Staff staff = staffRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("직원을 찾을 수 없습니다: " + id));
        apply(staff, name, role, workDays, startTime, endTime);
        return staffRepository.save(staff);
    }

    @Transactional
    public void delete(Long id) {
        if (!staffRepository.existsById(id)) throw new IllegalStateException("직원을 찾을 수 없습니다: " + id);
        staffRepository.deleteById(id);
    }

    private static void apply(Staff staff, String name, String role, List<String> workDays, String startTime, String endTime) {
        String n = name == null ? "" : name.trim();
        String r = role == null ? "" : role.trim();
        if (n.isEmpty() || n.length() > 50) throw new IllegalStateException("이름은 1~50자로 입력해 주세요.");
        if (r.isEmpty() || r.length() > 30) throw new IllegalStateException("역할은 1~30자로 입력해 주세요.");
        if (workDays == null || workDays.isEmpty()) throw new IllegalStateException("근무 요일을 하루 이상 골라 주세요.");
        if (!DAYS.containsAll(workDays)) throw new IllegalStateException("알 수 없는 요일이 있습니다: " + workDays);
        if (startTime == null || !TIME.matcher(startTime).matches() || endTime == null || !TIME.matcher(endTime).matches()) {
            throw new IllegalStateException("근무 시간은 HH:MM 형식이어야 합니다.");
        }
        if (endTime.compareTo(startTime) <= 0) throw new IllegalStateException("퇴근 시간은 출근 시간보다 늦어야 합니다.");
        staff.setName(n);
        staff.setRole(r);
        // 월→일 순서로 정렬하고 중복 제거해서 저장
        staff.setWorkDays(DAYS.stream().filter(workDays::contains).collect(Collectors.joining(",")));
        staff.setStartTime(startTime);
        staff.setEndTime(endTime);
    }

    /** 요청 본문의 workDays: 배열 또는 쉼표 문자열 모두 받는다. */
    public static List<String> parseDays(Object value) {
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).map(String::trim).toList();
        if (value == null) return List.of();
        return Arrays.stream(value.toString().split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
