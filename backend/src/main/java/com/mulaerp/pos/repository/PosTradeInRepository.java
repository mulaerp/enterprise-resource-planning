package com.mulaerp.pos.repository;

import com.mulaerp.pos.entity.PosTradeIn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PosTradeInRepository extends JpaRepository<PosTradeIn, UUID> {

    Optional<PosTradeIn> findByClientTradeInId(String clientTradeInId);

    Optional<PosTradeIn> findByIdAndDeletedFalse(UUID id);
}
