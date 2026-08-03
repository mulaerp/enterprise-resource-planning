package com.mulaerp.shop.repository;

import com.mulaerp.shop.entity.ShopCustomer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Reads/writes only the {@code shop_customers} table - deliberately has no cross-over with
 * {@code com.mulaerp.auth.repository.UserRepository}. Used exclusively by
 * {@code ShopAuthService} and {@code ShopCustomerAuthenticationFilter}; the staff auth stack
 * never queries this repository and this repository never queries {@code users}.
 */
@Repository
public interface ShopCustomerRepository extends JpaRepository<ShopCustomer, UUID> {

    Optional<ShopCustomer> findByEmailAndDeletedFalse(String email);

    boolean existsByEmail(String email);
}
