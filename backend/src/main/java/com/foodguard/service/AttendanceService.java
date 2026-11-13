package com.foodguard.service;

import com.foodguard.entity.Attendance;
import com.foodguard.entity.Employee;
import com.foodguard.repository.AttendanceRepository;
import com.foodguard.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 출퇴근 기록과 주간 급여·주휴수당.
 * 주휴수당은 실제 출퇴근 기록 기준: 한 주(월~일) 근무시간이 15시간 이상이면 min(근무시간, 40) / 40 × 8시간 × 시급.
 * 개근 여부는 보지 않는다. 퇴근 기록이 없는 출근은 근무시간에서 빼고 따로 센다.
 */
@Service
@RequiredArgsConstructor
public class AttendanceService {

    static final int HOLIDAY_MIN_WEEKLY_MINUTES = 15 * 60;
    static final int FULL_WEEK_MINUTES = 40 * 60;
    static final int HOLIDAY_HOURS = 8;
    // 이보다 오래 열린 출근은 퇴근을 잊은 것으로 보고, 다음 PIN 입력은 새 출근으로 처리한다
    static final int MAX_SHIFT_HOURS = 16;

    private final AttendanceRepository attendanceRepository;
    private final EmployeeRepository employeeRepository;

    // PIN 으로 출근/퇴근을 번갈아 기록. 응답: {employeeName, action: IN|OUT, time}
    @Transactional
    public Map<String, Object> clock(Long storeId, String pin) {
        Employee e = employeeRepository.findByStoreIdAndPinAndActiveTrue(storeId, pin == null ? "" : pin.trim())
                .orElseThrow(() -> new RuntimeException("PIN 이 맞지 않습니다."));
        LocalDateTime now = LocalDateTime.now();
        Optional<Attendance> open = attendanceRepository.findFirstByEmployeeIdAndClockOutIsNullOrderByClockInDesc(e.getId())
                .filter(a -> a.getClockIn().isAfter(now.minusHours(MAX_SHIFT_HOURS)));

        Attendance a;
        String action;
        if (open.isPresent()) {
            a = open.get();
            a.setClockOut(now);
            action = "OUT";
        } else {
            a = new Attendance();
            a.setEmployeeId(e.getId());
            a.setStoreId(storeId);
            a.setClockIn(now);
            action = "IN";
        }
        attendanceRepository.save(a);
        return Map.of("employeeName", e.getName(), "action", action, "time", now.toString());
    }

    // start~end(포함) 날짜에 출근한 기록
    public List<Attendance> getByStore(Long storeId, LocalDate start, LocalDate end) {
        return attendanceRepository.findByStoreIdAndClockInBetweenOrderByClockInAsc(
                storeId, start.atStartOfDay(), end.plusDays(1).atStartOfDay().minusNanos(1));
    }

    // 점주 수정. body: {clockIn, clockOut(비우면 근무 중)} — "yyyy-MM-ddTHH:mm"
    @Transactional
    public Attendance update(Long id, Map<String, Object> body) {
        Attendance a = attendanceRepository.findById(id).orElseThrow(() -> new RuntimeException("출퇴근 기록을 찾을 수 없습니다."));
        if (body.get("clockIn") != null) a.setClockIn(LocalDateTime.parse(body.get("clockIn").toString()));
        Object out = body.get("clockOut");
        a.setClockOut(out == null || out.toString().isBlank() ? null : LocalDateTime.parse(out.toString()));
        if (a.getClockOut() != null && !a.getClockOut().isAfter(a.getClockIn())) {
            throw new RuntimeException("퇴근 시각은 출근 시각보다 늦어야 합니다.");
        }
        return attendanceRepository.save(a);
    }

    @Transactional
    public void delete(Long id) {
        attendanceRepository.deleteById(id);
    }

    // weekStart(월요일)부터 7일
    public List<Map<String, Object>> weeklyPay(Long storeId, LocalDate weekStart) {
        return weeklyPay(employeeRepository.findByStoreIdOrderByActiveDescNameAsc(storeId),
                getByStore(storeId, weekStart, weekStart.plusDays(6)));
    }

    // 직원별 {employeeId, name, hourlyWage, workedMinutes, openShifts, basePay, holidayEligible, holidayPay, totalPay}
    // 그 주 기록이 없는 퇴사 직원은 뺀다
    static List<Map<String, Object>> weeklyPay(List<Employee> employees, List<Attendance> records) {
        Map<Long, Long> minutes = new HashMap<>();
        Map<Long, Integer> open = new HashMap<>();
        for (Attendance a : records) {
            if (a.getClockOut() == null) {
                open.merge(a.getEmployeeId(), 1, Integer::sum);
            } else {
                minutes.merge(a.getEmployeeId(), Duration.between(a.getClockIn(), a.getClockOut()).toMinutes(), Long::sum);
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Employee e : employees) {
            long worked = minutes.getOrDefault(e.getId(), 0L);
            int openShifts = open.getOrDefault(e.getId(), 0);
            if (!e.isActive() && worked == 0 && openShifts == 0) continue;

            int wage = e.getHourlyWage();
            long basePay = Math.round(worked / 60.0 * wage);
            boolean eligible = worked >= HOLIDAY_MIN_WEEKLY_MINUTES;
            long holidayPay = eligible
                    ? Math.round((double) Math.min(worked, FULL_WEEK_MINUTES) / FULL_WEEK_MINUTES * HOLIDAY_HOURS * wage)
                    : 0;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("employeeId", e.getId());
            row.put("name", e.getName());
            row.put("hourlyWage", wage);
            row.put("workedMinutes", worked);
            row.put("openShifts", openShifts);
            row.put("basePay", basePay);
            row.put("holidayEligible", eligible);
            row.put("holidayPay", holidayPay);
            row.put("totalPay", basePay + holidayPay);
            result.add(row);
        }
        return result;
    }
}
