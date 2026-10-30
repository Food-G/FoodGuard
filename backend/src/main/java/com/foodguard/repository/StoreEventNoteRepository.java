package com.foodguard.repository;

import com.foodguard.entity.StoreEventNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StoreEventNoteRepository extends JpaRepository<StoreEventNote, Long> {
    List<StoreEventNote> findByStoreIdOrderByEventDateDesc(Long storeId);
}
