package com.foodguard.controller;

import com.foodguard.entity.User;
import com.foodguard.security.AuthUser;
import com.foodguard.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// 상단 프로필·설정 다이얼로그 (UserDropdown.tsx). 인증 주체는 JwtFilter 가 넣은 이메일
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMyProfile(@AuthenticationPrincipal AuthUser user) {
        return ResponseEntity.ok(profile(userService.getByEmail(user.email())));
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateProfile(@AuthenticationPrincipal AuthUser user,
                                                             @RequestBody Map<String, Object> body) {
        Object userName = body.get("userName");
        return ResponseEntity.ok(profile(userService.updateUserName(user.email(), userName != null ? userName.toString() : null)));
    }

    @PutMapping("/me/password")
    public ResponseEntity<Map<String, String>> changePassword(@AuthenticationPrincipal AuthUser user,
                                                              @RequestBody Map<String, Object> body) {
        userService.changePassword(user.email(), String.valueOf(body.get("oldPassword")), String.valueOf(body.get("newPassword")));
        return ResponseEntity.ok(Map.of("message", "비밀번호 변경 완료"));
    }

    // 비밀번호 해시는 내보내지 않는다
    private static Map<String, Object> profile(User user) {
        return Map.of(
                "id", user.getId(),
                "email", user.getEmail(),
                "userName", user.getUserName() != null ? user.getUserName() : "",
                "role", user.getRole());
    }
}
