package com.foodguard.service;

import com.foodguard.dto.LoginRequest;
import com.foodguard.dto.SignupRequest;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import com.foodguard.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StoreRepository storeRepository;

    // 회원가입
    @Transactional
    public String signup(SignupRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setUserName(request.getUserName());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole());

        User savedUser = userRepository.save(user);

        if ("OWNER".equals(request.getRole()) && request.getStoreName() != null) {
            Store store = new Store();
            store.setStoreName(request.getStoreName());
            store.setRegion(request.getRegion() != null ? request.getRegion() : "미지정");
            store.setAddress(request.getAddress());
            store.setPhone(request.getPhone());
            store.setOpenedAt(java.time.LocalDate.now());
            store.setUser(savedUser);
            storeRepository.save(store);
        }

        return "회원가입 성공";
    }

    // 로그인 → JWT + 유저 정보 반환
    public Map<String, Object> login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("존재하지 않는 이메일입니다."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("비밀번호가 틀렸습니다.");
        }

<<<<<<< HEAD
        // 로그인 성공 → JWT 토큰 발급
        return jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
=======
        String token = jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());

        return Map.of(
                "token", token,
                "userId", user.getId(),
                "email", user.getEmail(),
                "userName", user.getUserName() != null ? user.getUserName() : "",
                "role", user.getRole()
        );
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
    }

    // 이메일로 유저 조회 (JWT 인증용)
    public User getByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

    // ID로 유저 조회
    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

    // 전체 유저 조회 (본사 관리자용)
    public List<User> getAll() {
        return userRepository.findAll();
    }

    // 프로필 수정
    @Transactional
    public User updateProfile(Long id, String userName) {
        User user = getById(id);
        user.setUserName(userName);
        return userRepository.save(user);
    }

    // 비밀번호 변경
    @Transactional
    public String changePassword(Long id, String oldPassword, String newPassword) {
        User user = getById(id);
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("현재 비밀번호가 맞지 않습니다.");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        return "비밀번호 변경 완료";
    }

    // 계정 삭제
    @Transactional
    public String deleteAccount(Long id) {
        if (!userRepository.existsById(id)) {
            throw new RuntimeException("유저를 찾을 수 없습니다.");
        }
        userRepository.deleteById(id);
        return "계정 삭제 완료";
    }
}
