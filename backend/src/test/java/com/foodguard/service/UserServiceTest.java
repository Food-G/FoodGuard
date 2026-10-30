package com.foodguard.service;

import com.foodguard.dto.SignupRequest;
import com.foodguard.entity.User;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import com.foodguard.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// DB 없이 프로필 이름 수정·비밀번호 변경 규칙만 검증
class UserServiceTest {

    private static final String EMAIL = "owner@test.com";

    private final UserRepository userRepository = mock(UserRepository.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final UserService service = new UserService(
            userRepository, encoder, mock(JwtUtil.class), mock(StoreRepository.class));

    private User user() {
        User u = new User();
        u.setEmail(EMAIL);
        u.setPassword(encoder.encode("old-pass"));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(u));
        when(userRepository.save(any())).thenAnswer(a -> a.getArgument(0));
        return u;
    }

    @Test
    void 현재_비밀번호가_맞아야_변경된다() {
        User u = user();
        assertThatThrownBy(() -> service.changePassword(EMAIL, "wrong", "new-pass")).hasMessageContaining("맞지 않습니다");
        assertThatThrownBy(() -> service.changePassword(EMAIL, "old-pass", "123")).hasMessageContaining("6자 이상");

        service.changePassword(EMAIL, "old-pass", "new-pass");
        assertThat(encoder.matches("new-pass", u.getPassword())).isTrue();
    }

    @Test
    void 회원가입으로_본사_관리자는_만들_수_없다() {
        SignupRequest request = new SignupRequest();
        request.setEmail("new@test.com");
        request.setPassword("pass1234");
        request.setRole("HQ_ADMIN");
        assertThatThrownBy(() -> service.signup(request)).hasMessageContaining("본사 관리자");
        verify(userRepository, never()).save(any());
    }

    @Test
    void 이름은_비어_있으면_안되고_앞뒤_공백은_지운다() {
        user();
        assertThatThrownBy(() -> service.updateUserName(EMAIL, "  ")).hasMessageContaining("이름을 입력");
        assertThat(service.updateUserName(EMAIL, " 지환 ").getUserName()).isEqualTo("지환");
    }
}
