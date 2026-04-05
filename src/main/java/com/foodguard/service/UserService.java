package com.foodguard.service;

import com.foodguard.dto.LoginRequest;
import com.foodguard.dto.SignupRequest;
import com.foodguard.entity.User;
import com.foodguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    // 회원가입
    public String signup(SignupRequest request) {

        // 이메일 중복 체크
        if (userRepository.existsByEmail(request.getEmail())) {
            return "이미 존재하는 이메일입니다.";
        }

        // 비밀번호 암호화해서 저장
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        userRepository.save(user);
        return "회원가입 성공";
    }

    // 로그인
    public String login(LoginRequest request) {

        // 이메일로 유저 찾기
        User user = userRepository.findByEmail(request.getEmail())
                .orElse(null);

        if (user == null) {
            return "존재하지 않는 이메일입니다.";
        }

        // 비밀번호 일치 확인
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            return "비밀번호가 틀렸습니다.";
        }

        return "로그인 성공";
    }
}