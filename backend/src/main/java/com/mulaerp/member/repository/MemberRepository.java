package com.mulaerp.member.repository;

import com.mulaerp.member.entity.Member;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MemberRepository extends JpaRepository<Member, UUID> {

    Page<Member> findByDeletedFalse(Pageable pageable);

    Optional<Member> findByIdAndDeletedFalse(UUID id);

    /**
     * WP: pessimistic write lock on the member row, held for the duration of the caller's
     * transaction - guards the store-credit credit/debit read-modify-write against a concurrent
     * mutation of the same balance (e.g. two near-simultaneous redemptions), same rationale as
     * WarehouseStockRepository#findByWarehouseIdAndProductIdForUpdate.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Member m WHERE m.id = :id AND m.deleted = false")
    Optional<Member> findByIdAndDeletedFalseForUpdate(@Param("id") UUID id);

    boolean existsByPhoneAndDeletedFalse(String phone);

    /** WP (repair refunds, V37): resolves whether a given phone number belongs to a registered
     * loyalty member - used to check "is this repair job's customer a member" before crediting a
     * store-credit refund (RepairJob has no direct memberId link, see RepairJobService). */
    Optional<Member> findByPhoneAndDeletedFalse(String phone);

    /** WP (shop customer registration, V39): resolves whether a registering shop customer's
     * email matches an existing loyalty member, so their points/store credit can be linked to
     * the new web account - see ShopAuthService#register. Case-insensitive: member.email has no
     * DB-level lower() normalisation, unlike shop_customers.email which is lowercased on write. */
    Optional<Member> findByEmailIgnoreCaseAndDeletedFalse(String email);

    @Query("SELECT m FROM Member m WHERE m.deleted = false AND " +
           "(LOWER(m.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.phone) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.code) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Member> searchMembers(@Param("search") String search, Pageable pageable);
}
