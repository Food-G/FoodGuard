package com.foodguard.controller;

import com.foodguard.dto.LoginRequest;
import com.foodguard.dto.SignupRequest;
import com.foodguard.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    // 회원가입 API
    @PostMapping("/signup")
    public ResponseEntity<String> signup(@RequestBody SignupRequest request) {
        return ResponseEntity.ok(userService.signup(request));
    }

    // 로그인 API
    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        try {
            String token = userService.login(request);
            return ResponseEntity.ok(token);
        } catch (RuntimeException e) {
            // UserService 의 안내 문구만 보여 준다. DB 오류 등은 GlobalExceptionHandler 로
            if (e.getClass() != RuntimeException.class) throw e;
            return ResponseEntity.status(401).body(e.getMessage());
        }    }
}