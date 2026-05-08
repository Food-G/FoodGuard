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

    public Store create(String storeName, String region, String businessType, String address, String contact) {
        Store store = new Store();
        store.setStoreName(storeName);
        store.setRegion(region);
        store.setBusinessType(businessType);
        store.setAddress(address);
        store.setHqManagerContact(contact);
        return storeRepository.save(store);
    }

    public List<Store> getMyStores(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        if (user.getStoreId() == null) return List.of();
        return storeRepository.findById(user.getStoreId())
                .map(List::of).orElse(List.of());
    }

    public List<Store> getAll() {
        return storeRepository.findAll();
    }

    public Store update(Long storeId, String storeName, String address, String contact) {
        Store store = storeRepository.findById(storeId)
                .orElseThrow(() -> new RuntimeException("가맹점을 찾을 수 없습니다."));
        store.setStoreName(storeName);
        store.setAddress(address);
        store.setHqManagerContact(contact);
        return storeRepository.save(store);
    }

    public String delete(Long storeId) {
        storeRepository.deleteById(storeId);
        return "가맹점 삭제 완료";
    }
}
