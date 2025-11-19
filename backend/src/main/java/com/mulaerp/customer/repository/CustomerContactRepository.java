package com.mulaerp.customer.repository;

import com.mulaerp.customer.entity.CustomerContact;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CustomerContactRepository extends JpaRepository<CustomerContact, UUID> {
    List<CustomerContact> findByCustomerIdAndDeletedFalse(UUID customerId);
}
