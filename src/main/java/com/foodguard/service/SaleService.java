package com.foodguard.service;

import com.foodguard.dto.SaleRequest;
import com.foodguard.dto.SaleResponse;
import com.foodguard.entity.Sale;
import com.foodguard.repository.SaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;

    // 매출 저장 (Create)
    public SaleResponse create(SaleRequest request) {
        Sale sale = new Sale();
        sale.setMenuName(request.getMenuName());
        sale.setQuantity(request.getQuantity());
        sale.setPrice(request.getPrice());
        sale.setSaleDate(request.getSaleDate());
        sale.setStoreId(request.getStoreId());

        Sale saved = saleRepository.save(sale);
        return new SaleResponse(saved);
    }

    // 전체 매출 조회 (Read)
    public List<SaleResponse> getAll() {
        return saleRepository.findAll()
                .stream()
                .map(SaleResponse::new)
                .collect(Collectors.toList());
    }

    // 특정 매출 조회 (Read)
    public SaleResponse getById(Long id) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("해당 매출 데이터가 없습니다."));
        return new SaleResponse(sale);
    }

    // 매출 수정 (Update)
    public SaleResponse update(Long id, SaleRequest request) {
        Sale sale = saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("해당 매출 데이터가 없습니다."));

        sale.setMenuName(request.getMenuName());
        sale.setQuantity(request.getQuantity());
        sale.setPrice(request.getPrice());
        sale.setSaleDate(request.getSaleDate());
        sale.setStoreId(request.getStoreId());

        Sale updated = saleRepository.save(sale);
        return new SaleResponse(updated);
    }

    // 매출 삭제 (Delete)
    public String delete(Long id) {
        saleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("해당 매출 데이터가 없습니다."));

        saleRepository.deleteById(id);
        return "삭제 완료";
    }
}