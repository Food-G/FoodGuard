package com.foodguard.repository;

import com.foodguard.entity.AgentProposal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AgentProposalRepository extends JpaRepository<AgentProposal, Long> {

    @Query("select p from AgentProposal p where (:storeId is null or p.storeId = :storeId) "
            + "and (:status is null or p.status = :status) and (:type is null or p.type = :type) "
            + "order by p.createdAt desc limit 200")
    List<AgentProposal> search(@Param("storeId") Long storeId, @Param("status") String status,
                               @Param("type") String type);

    @Modifying
    @Query("update AgentProposal p set p.status = 'EXPIRED' where p.status = 'PENDING' and p.expiresAt < :now")
    int expirePending(@Param("now") LocalDateTime now);
}
