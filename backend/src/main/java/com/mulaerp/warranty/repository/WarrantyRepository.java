package com.mulaerp.warranty.repository;

import com.mulaerp.warranty.entity.Warranty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * JpaSpecificationExecutor backs the multi-filter GET /api/v1/warranties (status/search both
 * optional) - see WarrantyService#buildSpecification, mirroring BankTransactionRepository's
 * house pattern (Specifications rather than "(:param IS NULL OR field = :param)" JPQL).
 */
@Repository
public interface WarrantyRepository extends JpaRepository<Warranty, UUID>, JpaSpecificationExecutor<Warranty> {

    Optional<Warranty> findByWarrantyNumberAndDeletedFalse(String warrantyNumber);

    Optional<Warranty> findByIdAndDeletedFalse(UUID id);

    Optional<Warranty> findBySerialIdAndDeletedFalse(UUID serialId);

    /** WP: the workmanship warranty issued at a repair job's COLLECTED transition, if any - see
     * WarrantyService#issueWorkmanshipWarranty / RepairJobService#toDtoWithDetails. */
    Optional<Warranty> findByRepairJobIdAndDeletedFalse(UUID repairJobId);

    /** V42 (WEBSHOP Gap B/C): every warranty issued by one online order - used both to surface
     * warranty numbers on that order's DTO (customer/guest lookup, staff admin view) and to void
     * them all when the order itself is voided (ShopOrderService#voidOrder). Not filtered by
     * status - a warranty already CLAIMED or VOID is still "issued by" this order for display
     * purposes; #voidOrder itself decides what to do with a non-ACTIVE one. */
    List<Warranty> findByShopOrderIdAndDeletedFalse(UUID shopOrderId);

    /** V42: batched form of the above for a page of orders (ShopOrderService's list endpoints) -
     * avoids one query per order row. */
    List<Warranty> findByShopOrderIdInAndDeletedFalse(List<UUID> shopOrderIds);
}
