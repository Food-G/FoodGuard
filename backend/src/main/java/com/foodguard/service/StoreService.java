package com.foodguard.service;

import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    // 가맹점 등록
    public Store create(Long userId, String storeName, String address, String phone) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Store store = new Store();
        store.setUser(user);
        store.setStoreName(storeName);
        store.setAddress(address);
        store.setPhone(phone);
        return storeRepository.save(store);
    }

    // 내 가맹점 목록 조회
    public List<Store> getMyStores(Long userId) {
        return storeRepository.findByUserId(userId);
    }

    // 전체 가맹점 조회 (본사용)
    public List<Store> getAll() {
        return storeRepository.findAll();
    }

    // 가맹점 수정
    public Store update(Long storeId, String storeName, String address, String phone) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        store.setStoreName(storeName);
        store.setAddress(address);
        store.setPhone(phone);
        return storeRepository.save(store);
    }

    // 가맹점 삭제
    public String delete(Long storeId) {
        storeRepository.deleteById(storeId);
        return "가맹점 삭제 완료";
    }
}