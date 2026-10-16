package com.foodguard.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter @Setter
@NoArgsConstructor
public class LocationMessage {
    private double lat;
    private double lng;
}
