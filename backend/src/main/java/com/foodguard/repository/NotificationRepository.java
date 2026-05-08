package com.foodguard.repository;

import com.foodguard.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByStoreIdAndIsReadFalse(Long storeId);
    List<Notification> findByStoreIdOrderByCreatedAtDesc(Long storeId);
    List<Notification> findByUserIdAndIsReadFalse(Long userId);
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
}
