package com.mulaerp.repair.repository;

import com.mulaerp.repair.entity.RepairJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * JpaSpecificationExecutor backs the multi-filter GET /api/v1/repairs (status/search both
 * optional) - see RepairJobService#buildSpecification.
 */
@Repository
public interface RepairJobRepository extends JpaRepository<RepairJob, UUID>, JpaSpecificationExecutor<RepairJob> {

    Optional<RepairJob> findByIdAndDeletedFalse(UUID id);

    /** WP: PublicRepairService's anonymous lookup by jobNumber. */
    Optional<RepairJob> findByJobNumberAndDeletedFalse(String jobNumber);
}
