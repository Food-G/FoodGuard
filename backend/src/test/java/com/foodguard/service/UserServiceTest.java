package com.foodguard.service;

import com.foodguard.dto.SignupRequest;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import com.foodguard.util.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class UserServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final UserService userService = new UserService(
            userRepository, new BCryptPasswordEncoder(), mock(JwtUtil.class), mock(StoreRepository.class));

    @Test
    @DisplayName("본사 관리자(HQ_ADMIN)로는 자가 가입할 수 없다")
    void hqAdminSignupIsRejected() {
        assertThrows(RuntimeException.class, () -> userService.signup(request("HQ_ADMIN")));
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("점주(OWNER)는 가입할 수 있다")
    void ownerSignupIsAllowed() {
        assertEquals("회원가입 성공", userService.signup(request("OWNER")));
        verify(userRepository).save(any());
    }

    private static SignupRequest request(String role) {
        SignupRequest request = new SignupRequest();
        request.setEmail("user@test.com");
        request.setPassword("password");
        request.setUserName("tester");
        request.setRole(role);
        return request;
    }
}
