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

    private final com.foodguard.repository.StoreRepository storeRepository;

    // 회원가입
    public String signup(SignupRequest request) {
        // AGENT 등 서비스 계정 역할은 가입으로 만들 수 없다 (DB 에서 직접 지정)
        if (!"OWNER".equals(request.getRole()) && !"HQ_ADMIN".equals(request.getRole())) {
            throw new IllegalStateException("가입할 수 없는 역할입니다: " + request.getRole());
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setUserName(request.getUserName());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        User savedUser = userRepository.save(user);

        // 점주일 경우 매장 정보도 함께 생성
        if ("OWNER".equals(request.getRole()) && request.getStoreName() != null) {
            com.foodguard.entity.Store store = new com.foodguard.entity.Store();
            store.setStoreName(request.getStoreName());
            store.setRegion(request.getRegion());
            store.setAddress(request.getAddress());
            store.setPhone(request.getPhone());
            store.setOpenedAt(java.time.LocalDate.now());
            store.setUser(savedUser); // 매장과 유저 연결
            storeRepository.save(store);
        }

        return "회원가입 성공";
    }

    // 로그인 → JWT 반환
    public String login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("존재하지 않는 이메일입니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("비밀번호가 틀렸습니다.");
        }

        // 로그인 성공 → JWT 토큰 발급
        return jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
    }
}