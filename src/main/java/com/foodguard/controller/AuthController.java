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
        String result = userService.signup(request);
        return ResponseEntity.ok(result);
    }

    // 로그인 API
    @PostMapping("/login")
    public ResponseEntity<String> login(@RequestBody LoginRequest request) {
        String result = userService.login(request);
        return ResponseEntity.ok(result);
    }
}