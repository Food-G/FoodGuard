package com.foodguard.service;

import com.foodguard.security.RateLimiter;
import java.util.regex.Pattern;
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
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final String LOGIN_FAILED = "이메일 또는 비밀번호가 올바르지 않습니다.";
    private static final int MAX_LOGIN_FAILURES = 10;
    private static final long LOGIN_WINDOW_MILLIS = 10 * 60 * 1000;

    private final BCryptPasswordEncoder passwordEncoder;
    private final RateLimiter rateLimiter;
    private final JwtUtil jwtUtil;

    private final com.foodguard.repository.StoreRepository storeRepository;

    // 회원가입
    public String signup(SignupRequest request) {
        if (request.getEmail() == null || !EMAIL.matcher(request.getEmail().trim()).matches()) {
            throw new RuntimeException("올바른 이메일을 입력해 주세요.");
        }
        checkPassword(request.getPassword());
        if (request.getUserName() == null || request.getUserName().isBlank()) {
            throw new RuntimeException("이름을 입력해 주세요.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("이미 존재하는 이메일입니다.");
        }
        // 회원가입으로는 점주 계정만 만든다. 본사 관리자를 스스로 고르면 모든 가맹점 데이터에 접근할 수 있게 되므로
        if (!"OWNER".equals(request.getRole())) {
            throw new RuntimeException("본사 관리자 계정은 회원가입으로 만들 수 없습니다. 관리자에게 요청하세요.");
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
        if (request.getEmail() == null || request.getPassword() == null) {
            throw new RuntimeException(LOGIN_FAILED);
        }
        String attemptKey = "login:" + request.getEmail().trim().toLowerCase();
        if (rateLimiter.isBlocked(attemptKey, MAX_LOGIN_FAILURES, LOGIN_WINDOW_MILLIS)) {
            throw new RuntimeException("로그인 실패가 많아 잠시 막혔습니다. 10분 뒤 다시 시도해 주세요.");
        }
        // 이메일 존재 여부를 알려 주지 않는다
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            rateLimiter.record(attemptKey);
            throw new RuntimeException(LOGIN_FAILED);
        }
        rateLimiter.reset(attemptKey);

        // 로그인 성공 → JWT 토큰 발급
        return jwtUtil.generateToken(user.getEmail(), user.getRole(), user.getId());
    }

    public User getByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

    // 프로필 이름 수정
    public User updateUserName(String email, String userName) {
        if (userName == null || userName.isBlank()) {
            throw new RuntimeException("이름을 입력해주세요.");
        }
        User user = getByEmail(email);
        user.setUserName(userName.trim());
        return userRepository.save(user);
    }

    private static void checkPassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new RuntimeException("비밀번호는 " + MIN_PASSWORD_LENGTH + "자 이상이어야 합니다.");
        }
    }

    // 비밀번호 변경
    public void changePassword(String email, String oldPassword, String newPassword) {
        User user = getByEmail(email);
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new RuntimeException("현재 비밀번호가 맞지 않습니다.");
        }
        checkPassword(newPassword);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}