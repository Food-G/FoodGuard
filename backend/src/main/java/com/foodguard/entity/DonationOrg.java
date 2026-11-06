package com.foodguard.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 기부처 (AG-3, 008_donation_org.sql). */
@Entity
@Table(name = "DONATION_ORG")
@Getter @Setter
@NoArgsConstructor
public class DonationOrg {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "org_id")
    private Long id;

    @Column(name = "org_name", nullable = false, length = 100)
    private String orgName;

    @Column(name = "org_type", nullable = false, length = 30)
    private String orgType;

    @Column(nullable = false, length = 50)
    private String region;

    @Column(name = "accepts_categories", length = 255)
    private String acceptsCategories;

    @Column(length = 100)
    private String contact;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;
}
