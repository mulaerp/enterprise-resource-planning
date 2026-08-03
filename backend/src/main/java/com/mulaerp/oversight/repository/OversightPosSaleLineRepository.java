package com.mulaerp.oversight.repository;

import com.mulaerp.pos.entity.PosSaleLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/** OVERSIGHT: read-only secondary repository over {@link PosSaleLine} - see OversightPosSaleRepository javadoc. */
@Repository
public interface OversightPosSaleLineRepository extends JpaRepository<PosSaleLine, UUID> {

    List<PosSaleLine> findByProductIdOrderByCreatedAtAsc(UUID productId);
}
