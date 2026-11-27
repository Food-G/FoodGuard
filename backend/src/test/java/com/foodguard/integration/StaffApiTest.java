package com.foodguard.integration;

import com.foodguard.IntegrationTest;
import com.foodguard.entity.Staff;
import com.foodguard.entity.Store;
import com.foodguard.entity.User;
import com.foodguard.repository.StaffRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 직원 관리 API: 등록·수정·삭제, 입력 검증, 매장 소유권 (점주는 자기 매장 직원만). */
class StaffApiTest extends IntegrationTest {

    @Autowired private StaffRepository staffRepository;

    private User owner, otherOwner, hq;
    private Store store, otherStore;

    @BeforeEach
    void setUp() {
        owner = user("OWNER");
        otherOwner = user("OWNER");
        hq = user("HQ_ADMIN");
        store = store(owner);
        otherStore = store(otherOwner);
    }

    private Map<String, Object> body(String name, List<String> days, String start, String end) {
        return Map.of("name", name, "role", "홀", "workDays", days, "startTime", start, "endTime", end);
    }

    @Test
    void ownerCreatesUpdatesAndDeletesOwnStaff() throws Exception {
        postAs(owner, "/api/staff/" + store.getId(), body("김지환", List.of("SUN", "MON", "MON", "FRI"), "10:00", "19:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workDays").value("MON,FRI,SUN"))   // 월→일 정렬, 중복 제거
                .andExpect(jsonPath("$.storeId").value(store.getId()));
        Staff saved = staffRepository.findByStoreIdOrderByIdAsc(store.getId()).get(0);

        getAs(owner, "/api/staff/store/" + store.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("김지환"));

        putAs(owner, "/api/staff/" + saved.getId(), body("김지환", List.of("TUE", "WED"), "09:30", "18:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workDays").value("TUE,WED"))
                .andExpect(jsonPath("$.startTime").value("09:30"));

        deleteAs(owner, "/api/staff/" + saved.getId()).andExpect(status().isOk());
        assertThat(staffRepository.findById(saved.getId())).isEmpty();
    }

    @Test
    void invalidInputIsRejected() throws Exception {
        String url = "/api/staff/" + store.getId();
        postAs(owner, url, body("", List.of("MON"), "09:00", "18:00")).andExpect(status().isBadRequest());
        postAs(owner, url, body("서준호", List.of(), "09:00", "18:00")).andExpect(status().isBadRequest());
        postAs(owner, url, body("서준호", List.of("XYZ"), "09:00", "18:00")).andExpect(status().isBadRequest());
        postAs(owner, url, body("서준호", List.of("MON"), "9시", "18:00")).andExpect(status().isBadRequest());
        postAs(owner, url, body("서준호", List.of("MON"), "18:00", "09:00")).andExpect(status().isBadRequest());
        assertThat(staffRepository.findByStoreIdOrderByIdAsc(store.getId())).isEmpty();
    }

    @Test
    void ownerCannotTouchAnotherStoresStaff() throws Exception {
        Staff other = new Staff();
        other.setStoreId(otherStore.getId());
        other.setName("남의 직원");
        other.setRole("주방");
        other.setWorkDays("MON");
        other.setStartTime("09:00");
        other.setEndTime("18:00");
        other = staffRepository.save(other);

        getAs(owner, "/api/staff/store/" + otherStore.getId()).andExpect(status().isForbidden());
        postAs(owner, "/api/staff/" + otherStore.getId(), body("침입", List.of("MON"), "09:00", "18:00")).andExpect(status().isForbidden());
        putAs(owner, "/api/staff/" + other.getId(), body("바꿈", List.of("MON"), "09:00", "18:00")).andExpect(status().isForbidden());
        deleteAs(owner, "/api/staff/" + other.getId()).andExpect(status().isForbidden());
        assertThat(staffRepository.findById(other.getId())).get().extracting(Staff::getName).isEqualTo("남의 직원");

        getAs(hq, "/api/staff/store/" + otherStore.getId()).andExpect(status().isOk());
    }
}
