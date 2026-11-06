package com.foodguard.service;

import com.foodguard.entity.Notification;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.NotificationRepository;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 알림 수신자와 생성 시각 (DB·Spring 컨텍스트 없음). */
class NotificationServiceTest {

    private NotificationRepository repo;
    private UserRepository users;
    private NotificationService service;
    private User owner;

    @BeforeEach
    void setUp() {
        repo = mock(NotificationRepository.class);
        users = mock(UserRepository.class);
        StoreRepository stores = mock(StoreRepository.class);
        service = new NotificationService(repo, stores, users);
        owner = new User();
        owner.setId(7L);
        Store store = new Store();
        store.setId(1L);
        store.setUser(owner);
        when(stores.findById(1L)).thenReturn(Optional.of(store));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void createdAtIsSetBecauseDuplicateCheckDependsOnIt() {
        // DB 기본값이 없어 비어 있으면 existsByStoreIdAndTypeAndMessageAndCreatedAtAfter 가 항상 false 다
        Notification n = service.create(1L, "m", "ORDER");
        assertNotNull(n.getCreatedAt());
        assertEquals(owner, n.getUser());
    }

    @Test
    void hqNotificationGoesToEveryAdminWithCreatedAt() {
        User a = new User();
        a.setId(1L);
        User b = new User();
        b.setId(2L);
        when(users.findByRole("HQ_ADMIN")).thenReturn(List.of(a, b));

        assertEquals(2, service.createForHq(1L, "m", "ORDER"));

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(repo, times(2)).save(saved.capture());
        assertEquals(List.of(a, b), saved.getAllValues().stream().map(Notification::getUser).toList());
        assertTrue(saved.getAllValues().stream().allMatch(n -> n.getCreatedAt() != null));
    }

    @Test
    void ownerInboxOnlyAsksForOwnerNotifications() {
        service.getUnread(1L);
        verify(repo).findByStoreIdAndUser_IdAndIsReadFalse(1L, 7L);
    }
}
