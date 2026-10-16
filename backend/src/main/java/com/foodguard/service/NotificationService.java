package com.foodguard.service;

import com.foodguard.entity.Notification;
import com.foodguard.entity.Store;
import com.foodguard.repository.NotificationRepository;
import com.foodguard.repository.StoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final StoreRepository storeRepository;

    // 알림 생성
    public Notification create(Long storeId, String message, String type) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Notification notification = new Notification();
        notification.setStore(store);
        notification.setMessage(message);
        notification.setType(type);
        return notificationRepository.save(notification);
    }

    // 읽지 않은 알림 조회
    public List<Notification> getUnread(Long storeId) {
        return notificationRepository.findByStoreIdAndIsReadFalse(storeId);
    }

    // 알림 단건 조회
    public Notification getById(Long id) {
        return notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("알림을 찾을 수 없습니다."));
    }

    // 알림 읽음 처리
    public String markAsRead(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("알림을 찾을 수 없습니다."));
        notification.setIsRead(true);
        notificationRepository.save(notification);
        return "알림 읽음 처리 완료";
    }
}