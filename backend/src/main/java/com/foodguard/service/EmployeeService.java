package com.foodguard.service;

import com.foodguard.entity.Employee;
import com.foodguard.entity.EmployeeSchedule;
import com.foodguard.repository.EmployeeRepository;
import com.foodguard.repository.EmployeeScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;

// 직원 명단과 주간 근무 스케줄
@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeScheduleRepository scheduleRepository;

    public List<Employee> getByStore(Long storeId) {
        return employeeRepository.findByStoreIdOrderByActiveDescNameAsc(storeId);
    }

    // body: {storeId, name, phone, hourlyWage, pin}
    @Transactional
    public Employee create(Map<String, Object> body) {
        Employee e = new Employee();
        e.setStoreId(Long.parseLong(body.get("storeId").toString()));
        apply(e, body);
        if (e.getName() == null || e.getHourlyWage() == null) throw new RuntimeException("이름과 시급을 입력하세요.");
        if (e.getPin() == null) throw new RuntimeException("PIN 4자리를 입력하세요.");
        return employeeRepository.save(e);
    }

    // body: name, phone, hourlyWage, pin(바꿀 때만), active 중 바꿀 항목
    @Transactional
    public Employee update(Long id, Map<String, Object> body) {
        Employee e = employeeRepository.findById(id).orElseThrow(() -> new RuntimeException("직원을 찾을 수 없습니다."));
        if (body.get("active") != null) e.setActive(Boolean.parseBoolean(body.get("active").toString()));
        apply(e, body);
        return employeeRepository.save(e);
    }

    private void apply(Employee e, Map<String, Object> body) {
        if (body.containsKey("name")) {
            String name = body.get("name") == null ? "" : body.get("name").toString().trim();
            if (name.isEmpty()) throw new RuntimeException("이름을 입력하세요.");
            e.setName(name);
        }
        if (body.containsKey("phone")) e.setPhone(body.get("phone") == null ? null : body.get("phone").toString().trim());
        if (body.containsKey("hourlyWage")) {
            int wage = Integer.parseInt(body.get("hourlyWage").toString());
            if (wage <= 0) throw new RuntimeException("시급을 입력하세요.");
            e.setHourlyWage(wage);
        }
        String pin = body.get("pin") == null ? "" : body.get("pin").toString().trim();
        if (!pin.isEmpty()) {
            if (!pin.matches("\\d{4}")) throw new RuntimeException("PIN 은 숫자 4자리입니다.");
            if (!pin.equals(e.getPin()) && employeeRepository.existsByStoreIdAndPinAndActiveTrue(e.getStoreId(), pin)) {
                throw new RuntimeException("이미 다른 직원이 쓰는 PIN 입니다.");
            }
            e.setPin(pin);
        }
    }

    public List<EmployeeSchedule> getSchedules(Long storeId) {
        return scheduleRepository.findByStoreIdOrderByWeekdayAscStartTimeAsc(storeId);
    }

    // body: {storeId, employeeId, weekday(1=월…7=일), startTime "HH:mm", endTime "HH:mm"}
    @Transactional
    public EmployeeSchedule createSchedule(Map<String, Object> body) {
        Long storeId = Long.parseLong(body.get("storeId").toString());
        Long employeeId = Long.parseLong(body.get("employeeId").toString());
        Employee e = employeeRepository.findById(employeeId).orElseThrow(() -> new RuntimeException("직원을 찾을 수 없습니다."));
        if (!e.getStoreId().equals(storeId)) throw new RuntimeException("이 매장 직원이 아닙니다.");
        int weekday = Integer.parseInt(body.get("weekday").toString());
        if (weekday < 1 || weekday > 7) throw new RuntimeException("요일이 올바르지 않습니다.");
        LocalTime start = LocalTime.parse(body.get("startTime").toString());
        LocalTime end = LocalTime.parse(body.get("endTime").toString());
        if (!end.isAfter(start)) throw new RuntimeException("종료 시각은 시작 시각보다 늦어야 합니다.");

        EmployeeSchedule s = new EmployeeSchedule();
        s.setStoreId(storeId);
        s.setEmployeeId(employeeId);
        s.setWeekday(weekday);
        s.setStartTime(start);
        s.setEndTime(end);
        return scheduleRepository.save(s);
    }

    @Transactional
    public void deleteSchedule(Long id) {
        scheduleRepository.deleteById(id);
    }
}
