package com.mulaerp.pos.repository;

import com.mulaerp.pos.entity.PosSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PosSaleRepository extends JpaRepository<PosSale, UUID> {

    /** Idempotency lookup - see PosSale Javadoc. */
    Optional<PosSale> findByClientSaleId(String clientSaleId);
}
