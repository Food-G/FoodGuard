package com.foodguard.controller;

import com.foodguard.dto.LoginRequest;
import com.foodguard.dto.SignupRequest;
import com.foodguard.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody SignupRequest request) {
        try {
            String result = userService.signup(request);
<<<<<<< HEAD
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.toString();
            return ResponseEntity.badRequest().body(errorMessage);
=======
            return ResponseEntity.ok(Map.of("message", result));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
<<<<<<< HEAD
            String token = userService.login(request);
            return ResponseEntity.ok(token);
        } catch (Exception e) {
            String errorMessage = e.getMessage() != null ? e.getMessage() : e.toString();
            return ResponseEntity.status(401).body(errorMessage);
=======
            Map<String, Object> result = userService.login(request);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
        }
    }
}
