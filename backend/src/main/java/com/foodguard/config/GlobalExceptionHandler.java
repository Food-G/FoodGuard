package com.foodguard.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.converter.HttpMessageNotWritableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.format.DateTimeParseException;
import java.util.Map;

// 사용자에게는 서비스가 직접 던진 안내 문구만 보여 준다. 내부 오류 내용(SQL, 클래스명)은 로그에만 남긴다
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private static final String BAD_REQUEST = "요청 형식이 올바르지 않습니다. 입력값을 확인해 주세요.";

    private static ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    // 다른 가맹점 데이터 접근 (security.StoreAccess)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException e) {
        return error(HttpStatus.FORBIDDEN, e.getMessage());
    }

    // 필수값 누락(NPE)·숫자/날짜 형식 오류·잘못된 JSON
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class, NullPointerException.class, NumberFormatException.class,
            DateTimeParseException.class, ClassCastException.class, IllegalArgumentException.class})
    public ResponseEntity<Map<String, String>> handleBadInput(Exception e) {
        log.debug("잘못된 요청: {}", e.getMessage());
        return error(HttpStatus.BAD_REQUEST, BAD_REQUEST);
    }

    @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
    public ResponseEntity<Map<String, String>> handleNotFound(ErrorResponseException e) {
        return error(HttpStatus.valueOf(e.getStatusCode().value()), "요청한 주소를 찾을 수 없습니다.");
    }

    // ResponseStatusException 등 (횟수 제한 429 포함)
    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ErrorResponseException e) {
        return error(HttpStatus.valueOf(e.getStatusCode().value()), String.valueOf(e.getBody().getDetail()));
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, String>> handleDatabase(DataAccessException e) {
        log.error("DB 오류", e);
        return error(HttpStatus.SERVICE_UNAVAILABLE, "일시적인 오류입니다. 잠시 후 다시 시도해 주세요.");
    }

    @ExceptionHandler(HttpMessageNotWritableException.class)
    public ResponseEntity<Map<String, String>> handleSerialization(HttpMessageNotWritableException e) {
        log.error("응답 직렬화 오류", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException e) {
        // 서비스의 안내 문구는 RuntimeException 직접 생성. 그 외 하위 타입은 내부 오류로 본다
        if (e.getClass() == RuntimeException.class && e.getMessage() != null) {
            return error(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        log.error("처리되지 않은 오류", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception e) {
        log.error("처리되지 않은 오류", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다.");
    }
}
