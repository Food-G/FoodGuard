package com.foodguard.dto;

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SignupRequest {
    private String email;
    private String password;
    private String name;
    private String role; // "OWNER" 또는 "ADMIN"
}
