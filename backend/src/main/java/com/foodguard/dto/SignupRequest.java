package com.foodguard.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SignupRequest {
    private String email;
    private String password;
    private String userName;
    private String role;   // "OWNER" 또는 "HQ"
    
    // 가맹점 정보 (OWNER일 경우 필요)
    private String storeName;
    private String region;
    private String address;
    private String phone;
}
