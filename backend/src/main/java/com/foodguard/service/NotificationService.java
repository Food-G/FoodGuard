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

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    // 알림 생성 (기본 - storeId만)
    @Transactional
    public Notification create(Long storeId, String message, String type) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        Notification notification = new Notification();
        notification.setStore(store);
        notification.setMessage(message);
        notification.setType(type);
        return notificationRepository.save(notification);
    }

    // 알림 생성 (userId 포함)
    @Transactional
    public Notification create(Long storeId, Long userId, String message, String type) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Notification notification = new Notification();
        notification.setStore(store);
        notification.setUser(user);
        notification.setMessage(message);
        notification.setType(type);
        return notificationRepository.save(notification);
    }

    // 재고 부족 자동 알림 생성 (내부 사용)
    @Transactional
    public void createStockAlert(Long storeId, String ingredientName, double currentQty, String unit) {
        Store store = storeRepository.findById(storeId).orElse(null);
        if (store == null) return;

        String message = String.format("[재고 부족] %s의 재고가 최소 기준 이하입니다. 현재: %.2f%s",
                ingredientName, currentQty, unit);

        Notification notification = new Notification();
        notification.setStore(store);
        notification.setMessage(message);
        notification.setType("STOCK");

        // 매장 담당 유저 연결
        if (store.getUser() != null) {
            notification.setUser(store.getUser());
        }

        notificationRepository.save(notification);
    }

    // 읽지 않은 알림 조회 (매장 기준)
    public List<Notification> getUnread(Long storeId) {
        return notificationRepository.findByStoreIdAndIsReadFalse(storeId);
    }

    // 전체 알림 조회 (매장 기준)
    public List<Notification> getAll(Long storeId) {
        return notificationRepository.findByStoreIdOrderByCreatedAtDesc(storeId);
    }

    // 유저 기준 읽지 않은 알림
    public List<Notification> getUnreadByUser(Long userId) {
        return notificationRepository.findByUserIdAndIsReadFalse(userId);
    }

    // 유저 기준 전체 알림
    public List<Notification> getAllByUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // 알림 읽음 처리
    @Transactional
    public String markAsRead(Long id) {
        Notification notification = notificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("알림을 찾을 수 없습니다."));
        notification.setIsRead(true);
        notificationRepository.save(notification);
        return "알림 읽음 처리 완료";
    }

    // 매장 전체 알림 읽음 처리
    @Transactional
    public String markAllAsRead(Long storeId) {
        List<Notification> unread = notificationRepository.findByStoreIdAndIsReadFalse(storeId);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
        return "전체 알림 읽음 처리 완료 (" + unread.size() + "건)";
    }

    // 알림 삭제
    @Transactional
    public String delete(Long id) {
        if (!notificationRepository.existsById(id)) {
            throw new RuntimeException("알림을 찾을 수 없습니다.");
        }
        notificationRepository.deleteById(id);
        return "알림 삭제 완료";
    }
}
