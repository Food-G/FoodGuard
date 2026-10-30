package com.foodguard.security;

import lombok.RequiredArgsConstructor;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import java.lang.reflect.Type;
import java.util.Map;

// 요청 본문(Map)의 storeId·userId·menuId 가 로그인한 점주의 것인지 검사 (경로 쪽은 StoreAccessInterceptor)
@ControllerAdvice
@RequiredArgsConstructor
public class StoreAccessBodyAdvice extends RequestBodyAdviceAdapter {

    private final StoreAccess storeAccess;

    @Override
    public boolean supports(MethodParameter methodParameter, Type targetType,
                            Class<? extends HttpMessageConverter<?>> converterType) {
        return Map.class.isAssignableFrom(methodParameter.getParameterType());
    }

    @Override
    public Object afterBodyRead(Object body, HttpInputMessage inputMessage, MethodParameter parameter,
                                Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        Map<?, ?> map = (Map<?, ?>) body;
        if (map.get("storeId") != null) storeAccess.checkStore(Long.valueOf(map.get("storeId").toString()));
        if (map.get("userId") != null) storeAccess.checkUser(Long.valueOf(map.get("userId").toString()));
        if (map.get("menuId") != null) storeAccess.checkEntity("Menu", Long.valueOf(map.get("menuId").toString()));
        return body;
    }
}
