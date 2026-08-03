package com.mulaerp.repair.repository;

import com.mulaerp.repair.entity.RepairPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RepairPaymentRepository extends JpaRepository<RepairPayment, UUID> {

    List<RepairPayment> findByRepairJobIdOrderByPaidAtAsc(UUID repairJobId);
}
