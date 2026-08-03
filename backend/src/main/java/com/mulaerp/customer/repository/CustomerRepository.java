package com.mulaerp.customer.repository;

import com.mulaerp.customer.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, UUID> {
    Page<Customer> findByDeletedFalse(Pageable pageable);
    
    Optional<Customer> findByIdAndDeletedFalse(UUID id);

    // WP10: used by the CSV customer importer to dedupe rows on email.
    Optional<Customer> findByEmailIgnoreCaseAndDeletedFalse(String email);

    @Query("SELECT c FROM Customer c WHERE c.deleted = false AND " +
           "(LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Customer> searchCustomers(@Param("search") String search, Pageable pageable);
}
