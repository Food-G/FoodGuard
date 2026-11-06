package com.foodguard.repository;

import com.foodguard.entity.DonationOrg;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DonationOrgRepository extends JpaRepository<DonationOrg, Long> {
    List<DonationOrg> findByIsActiveTrue();
}
