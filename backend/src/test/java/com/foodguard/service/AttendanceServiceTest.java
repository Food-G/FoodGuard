package com.foodguard.service;

import com.foodguard.entity.Attendance;
import com.foodguard.entity.Employee;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

// DB 없이 주간 급여·주휴수당 계산만 검증 (시급 10,000원)
class AttendanceServiceTest {

    private static final LocalDateTime MON = LocalDateTime.of(2026, 11, 9, 9, 0);

    @Test
    void 주_15시간_미만이면_주휴수당이_없다() {
        Map<String, Object> row = pay(shifts(1L, 2, 7 * 60 + 29)); // 14시간 58분

        assertThat(row.get("workedMinutes")).isEqualTo(898L);
        assertThat(row.get("holidayEligible")).isEqualTo(false);
        assertThat(row.get("holidayPay")).isEqualTo(0L);
        assertThat(row.get("basePay")).isEqualTo(149_667L);
    }

    @Test
    void 주_15시간이면_15_나누기_40_곱하기_8시간분을_준다() {
        Map<String, Object> row = pay(shifts(1L, 3, 5 * 60)); // 15시간

        assertThat(row.get("holidayEligible")).isEqualTo(true);
        assertThat(row.get("holidayPay")).isEqualTo(30_000L); // 15/40 × 8 × 10,000
        assertThat(row.get("totalPay")).isEqualTo(180_000L);
    }

    @Test
    void 주휴수당은_40시간에서_멈춘다() {
        Map<String, Object> row = pay(shifts(1L, 5, 10 * 60)); // 50시간

        assertThat(row.get("holidayPay")).isEqualTo(80_000L); // 8 × 10,000
        assertThat(row.get("basePay")).isEqualTo(500_000L);
    }

    @Test
    void 퇴근_기록이_없는_출근은_근무시간에서_빼고_센다() {
        List<Attendance> records = new ArrayList<>(shifts(1L, 2, 8 * 60));
        Attendance open = new Attendance();
        open.setEmployeeId(1L);
        open.setClockIn(MON.plusDays(3));
        records.add(open);

        Map<String, Object> row = pay(records);

        assertThat(row.get("workedMinutes")).isEqualTo(960L);
        assertThat(row.get("openShifts")).isEqualTo(1);
    }

    @Test
    void 그_주_기록이_없는_퇴사_직원은_빠지고_재직_직원은_0원으로_나온다() {
        Employee left = employee(2L);
        left.setActive(false);

        List<Map<String, Object>> rows = AttendanceService.weeklyPay(List.of(employee(1L), left), List.of());

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).get("employeeId")).isEqualTo(1L);
        assertThat(rows.get(0).get("totalPay")).isEqualTo(0L);
    }

    private Map<String, Object> pay(List<Attendance> records) {
        return AttendanceService.weeklyPay(List.of(employee(1L)), records).get(0);
    }

    private static Employee employee(Long id) {
        Employee e = new Employee();
        e.setId(id);
        e.setName("직원" + id);
        e.setHourlyWage(10_000);
        return e;
    }

    // 월요일부터 하루 하나씩 minutes 분 근무
    private static List<Attendance> shifts(Long employeeId, int days, int minutes) {
        List<Attendance> list = new ArrayList<>();
        for (int d = 0; d < days; d++) {
            Attendance a = new Attendance();
            a.setEmployeeId(employeeId);
            a.setClockIn(MON.plusDays(d));
            a.setClockOut(MON.plusDays(d).plusMinutes(minutes));
            list.add(a);
        }
        return list;
    }
}
