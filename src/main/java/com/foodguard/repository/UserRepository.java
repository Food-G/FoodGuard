package com.foodguard.repository;

import com.foodguard.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    // 이메일로 유저 찾기 (로그인할 때 사용)
    Optional<User> findByEmail(String email);

    // 이메일 중복 체크 (회원가입할 때 사용)
    boolean existsByEmail(String email);
}