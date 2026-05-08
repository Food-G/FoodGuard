package com.foodguard.controller;

import com.foodguard.entity.User;
import com.foodguard.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 내 프로필 조회 (JWT 기반)
    @GetMapping("/me")
    public ResponseEntity<?> getMyProfile(@AuthenticationPrincipal String email) {
        try {
            User user = userService.getByEmail(email);
            return ResponseEntity.ok(Map.of(
                    "id", user.getId(),
                    "email", user.getEmail(),
                    "userName", user.getUserName() != null ? user.getUserName() : "",
                    "role", user.getRole(),
                    "storeId", user.getStoreId() != null ? user.getStoreId() : ""
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 전체 유저 조회 (본사 관리자용)
    @GetMapping
    public ResponseEntity<List<User>> getAll() {
        return ResponseEntity.ok(userService.getAll());
    }

    // 특정 유저 조회
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(userService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 내 프로필 수정
    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@AuthenticationPrincipal String email,
                                           @RequestBody Map<String, Object> body) {
        try {
            User user = userService.getByEmail(email);
            String userName = body.get("userName") != null ? body.get("userName").toString() : null;
            return ResponseEntity.ok(userService.updateProfile(user.getId(), userName));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 비밀번호 변경
    @PutMapping("/me/password")
    public ResponseEntity<?> changePassword(@AuthenticationPrincipal String email,
                                            @RequestBody Map<String, Object> body) {
        try {
            User user = userService.getByEmail(email);
            return ResponseEntity.ok(Map.of("message", userService.changePassword(
                    user.getId(),
                    body.get("oldPassword").toString(),
                    body.get("newPassword").toString()
            )));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // 계정 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAccount(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("message", userService.deleteAccount(id)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
