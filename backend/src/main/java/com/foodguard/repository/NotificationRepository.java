package com.foodguard.repository;

import com.foodguard.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByStoreIdAndUser_IdAndIsReadFalse(Long storeId, Long userId);

    List<Notification> findByUser_IdAndIsReadFalse(Long userId);

    boolean existsByStoreIdAndTypeAndMessageAndCreatedAtAfter(Long storeId, String type, String message,
                                                               java.time.LocalDateTime after);
}