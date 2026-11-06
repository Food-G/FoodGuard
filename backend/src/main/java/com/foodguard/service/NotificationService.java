package com.foodguard.service;

import com.foodguard.entity.Notification;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.NotificationRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    // 알림 생성
    public Notification create(Long storeId, String message, String type) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        // NOTIFICATION.user_id 는 NOT NULL — 매장 소유 점주를 수신자로 지정한다
        if (store.getUser() == null) {
            throw new RuntimeException("가맹점에 소유 점주가 없어 알림을 생성할 수 없습니다.");
        }
        return notificationRepository.save(build(store.getUser(), store, message, type));
    }

    /** 본사 관리자 전원에게 보낸다 (입고 지연 AG-7). 점주 알림함에는 나오지 않는다. */
    @Transactional
    public int createForHq(Long storeId, String message, String type) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        List<User> admins = userRepository.findByRole("HQ_ADMIN");
        admins.forEach(admin -> notificationRepository.save(build(admin, store, message, type)));
        return admins.size();
    }

    private static Notification build(User user, Store store, String message, String type) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setStore(store);
        notification.setMessage(message);
        notification.setType(type);
        notification.setCreatedAt(LocalDateTime.now());
        return notification;
    }

    public boolean existsRecent(Long storeId, String type, String message, int hours) {
        return notificationRepository.existsByStoreIdAndTypeAndMessageAndCreatedAtAfter(
                storeId, type, message, java.time.LocalDateTime.now().minusHours(hours));
    }

    // 읽지 않은 알림 조회 (매장 점주 앞으로 온 것만)
    public List<Notification> getUnread(Long storeId) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        if (store.getUser() == null) return List.of();
        return notificationRepository.findByStoreIdAndUser_IdAndIsReadFalse(storeId, store.getUser().getId());
    }

    public List<Notification> getUnreadForUser(Long userId) {
        return notificationRepository.findByUser_IdAndIsReadFalse(userId);
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
