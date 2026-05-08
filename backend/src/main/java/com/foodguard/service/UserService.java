package com.foodguard.service;

import com.foodguard.dto.LoginRequest;
import com.foodguard.dto.SignupRequest;
import com.foodguard.entity.User;
import com.foodguard.repository.UserRepository;
import com.foodguard.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public String signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return "이미 존재하는 이메일입니다.";
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        user.setRole(request.getRole());

        userRepository.save(user);
        return "회원가입 성공";
    }

    public String login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);

        if (user == null) return "존재하지 않는 이메일입니다.";

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return "비밀번호가 틀렸습니다.";
        }

        return jwtUtil.generateToken(user.getEmail(), user.getRole());
    }
}
