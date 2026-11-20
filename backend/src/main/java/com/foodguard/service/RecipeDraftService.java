package com.foodguard.service;

import com.foodguard.entity.Ingredient;
import com.foodguard.entity.Menu;
import com.foodguard.entity.MenuIngredient;
import com.foodguard.repository.IngredientRepository;
import com.foodguard.repository.MenuIngredientRepository;
import com.foodguard.repository.MenuRepository;
import com.foodguard.util.UnitUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 레시피 입력 보조: 메뉴명과 이 매장 식자재 목록을 AI 서비스(/api/recipes/draft, claude CLI)로 보내
 * 메뉴 1개당 식자재 사용량 초안을 받는다. 저장하지 않고, 점주가 확인한 항목만 기존 등록 API로 저장한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecipeDraftService {

    private final MenuRepository menuRepository;
    private final IngredientRepository ingredientRepository;
    private final MenuIngredientRepository menuIngredientRepository;
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public Map<String, Object> draft(Long menuId) {
        Menu menu = menuRepository.findById(menuId)
                .orElseThrow(() -> new RuntimeException("메뉴를 찾을 수 없습니다."));
        List<Ingredient> linked = menuIngredientRepository.findByMenuId(menuId).stream()
                .map(MenuIngredient::getIngredient).toList();
        List<Map<String, Object>> candidates = ingredientRepository.findByStoreIdIncludingLegacy(menu.getStore().getId()).stream()
                .filter(i -> linked.stream().noneMatch(l -> l.getId().equals(i.getId())))
                .map(i -> Map.<String, Object>of("ingredientId", i.getId(), "name", i.getName(),
                        "unit", UnitUtils.toRecipeUnit(i.getUnit())))
                .toList();

        Map<String, Object> body = new HashMap<>();
        body.put("menuName", menu.getMenuName());
        body.put("category", menu.getCategory());
        body.put("ingredients", candidates);
        body.put("linked", linked.stream().map(Ingredient::getName).toList());
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> draft = restTemplate.postForObject(aiServiceUrl + "/api/recipes/draft", body, Map.class);
            return draft;
        } catch (RestClientException e) {
            log.warn("AI 레시피 초안 호출 실패 (menu {}): {}", menuId, e.getMessage());
            throw new RuntimeException("AI 레시피 초안을 만들지 못했습니다. AI 서비스와 claude CLI 로그인 상태를 확인하세요.");
        }
    }
}
