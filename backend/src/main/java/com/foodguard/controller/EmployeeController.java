package com.foodguard.controller;

import com.foodguard.entity.Employee;
import com.foodguard.entity.EmployeeSchedule;
import com.foodguard.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping("/api/employees/{storeId}")
    public ResponseEntity<List<Employee>> getByStore(@PathVariable Long storeId) {
        return ResponseEntity.ok(employeeService.getByStore(storeId));
    }

    // body: {storeId, name, phone, hourlyWage, pin}
    @PostMapping("/api/employees")
    public ResponseEntity<Employee> create(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(employeeService.create(body));
    }

    // 퇴사 처리는 {active: false}
    @PutMapping("/api/employees/{id}")
    public ResponseEntity<Employee> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(employeeService.update(id, body));
    }

    @GetMapping("/api/employee-schedules/{storeId}")
    public ResponseEntity<List<EmployeeSchedule>> getSchedules(@PathVariable Long storeId) {
        return ResponseEntity.ok(employeeService.getSchedules(storeId));
    }

    // body: {storeId, employeeId, weekday(1=월…7=일), startTime "HH:mm", endTime "HH:mm"}
    @PostMapping("/api/employee-schedules")
    public ResponseEntity<EmployeeSchedule> createSchedule(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(employeeService.createSchedule(body));
    }

    @DeleteMapping("/api/employee-schedules/{id}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable Long id) {
        employeeService.deleteSchedule(id);
        return ResponseEntity.ok().build();
    }
}
