package com.foodguard.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 비즈니스 규칙 위반을 400 으로 변환한다.
 *
 * 이전에는 "승인된 발주는 취소할 수 없습니다" 같은 실패도 HTTP 200 본문으로 내려가
 * 클라이언트(및 에이전트)가 성공/실패를 구분할 수 없었다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleIllegalState(IllegalStateException e) {
        return ResponseEntity.badRequest().body(e.getMessage());
    }
}
