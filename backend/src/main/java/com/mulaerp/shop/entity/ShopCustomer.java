package com.mulaerp.shop.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

/**
 * A registered customer of the B2C storefront (SHOP module) - entirely separate from
 * {@code com.mulaerp.auth.entity.User} (staff). This entity has no {@code role} field and is
 * never loaded by {@code CustomUserDetailsService}, so a shop customer can never obtain a staff
 * authority - see the V39 migration javadoc and {@code ShopCustomerAuthenticationFilter}.
 *
 * <p>{@link #memberId} optionally links this web account to an existing loyalty
 * {@code com.mulaerp.member.entity.Member} row (by matching email at registration time - see
 * {@code ShopAuthService#register}) so points/store credit earned in-store carry over to the web
 * account. The FK lives here, pointing at {@code members} - {@code members} itself gains no new
 * column.
 */
@Entity
@Table(name = "shop_customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ShopCustomer extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String fullName;

    private String phone;

    /** Optional link to an existing loyalty {@code Member} - see class javadoc. */
    @Column(name = "member_id")
    private UUID memberId;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ShopCustomerStatus status = ShopCustomerStatus.ACTIVE;

    public enum ShopCustomerStatus {
        ACTIVE, SUSPENDED
    }
}
