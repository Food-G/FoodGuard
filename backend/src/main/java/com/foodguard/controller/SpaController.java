package com.foodguard.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

    // /api/** 와 정적 파일을 제외한 모든 경로를 React가 처리하도록 index.html로 포워딩
    @GetMapping(value = { "/", "/{path:^(?!api|assets|favicon|LOGO|Logo|icons).*$}/**" })
    public String spa() {
        return "forward:/index.html";
    }
}
