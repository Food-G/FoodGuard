package com.foodguard.repository;

import com.foodguard.entity.AgentRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AgentRunRepository extends JpaRepository<AgentRun, String> {

    @Query("select r from AgentRun r where (:agent is null or r.agent = :agent) "
            + "and (:storeId is null or r.storeId = :storeId) order by r.startedAt desc limit 100")
    List<AgentRun> search(@Param("agent") String agent, @Param("storeId") Long storeId);
}
