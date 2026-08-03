package com.mulaerp.repair.repository;

import com.mulaerp.repair.entity.RepairPart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RepairPartRepository extends JpaRepository<RepairPart, UUID> {

    List<RepairPart> findByRepairJobIdOrderByCreatedAtAsc(UUID repairJobId);
}
