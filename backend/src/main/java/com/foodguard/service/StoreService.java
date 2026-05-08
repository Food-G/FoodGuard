package com.foodguard.service;

import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.StoreRepository;
import com.foodguard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StoreService {

    private final StoreRepository storeRepository;
    private final UserRepository userRepository;

    // 가맹점 등록
    @Transactional
    public Store create(Long userId, String storeName, String address, String phone) {        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Store store = new Store();
        store.setUser(user);
        store.setStoreName(storeName);
        store.setAddress(address);
        store.setPhone(phone);
        store.setRegion("미지정");
        store.setOpenedAt(java.time.LocalDate.now());        return storeRepository.save(store);
    }

    // 단건 조회
    public Store getById(Long id) {
        return storeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
    }

    // 내 가맹점 목록 조회
    public List<Store> getMyStores(Long userId) {
        return storeRepository.findByUserId(userId);
    }

    // 전체 가맹점 조회 (본사용)
    public List<Store> getAll() {
        return storeRepository.findAll();
    }

    // 지역별 조회
    public List<Store> getByRegion(String region) {
        return storeRepository.findByRegion(region);
    }

    // 활성 가맹점만 조회
    public List<Store> getActiveStores() {
        return storeRepository.findByIsActiveTrue();
    }

    // 가맹점 수정
    @Transactional
    public Store update(Long storeId, String storeName, String address, String phone) {
        Store store = getById(storeId);
        if (storeName != null) store.setStoreName(storeName);
        if (address != null) store.setAddress(address);
        if (phone != null) store.setPhone(phone);
        return storeRepository.save(store);
    }

    // 활성화 토글 (활성 ↔ 비활성)
    @Transactional
    public Store toggleActive(Long storeId) {
        Store store = getById(storeId);
        store.setActive(!store.isActive());        return storeRepository.save(store);
    }

    // 가맹점 삭제
    @Transactional
    public String delete(Long storeId) {
        if (!storeRepository.existsById(storeId)) {
            throw new RuntimeException("가맹점을 찾을 수 없습니다.");
        }
        storeRepository.deleteById(storeId);
        return "가맹점 삭제 완료";
    }
}
