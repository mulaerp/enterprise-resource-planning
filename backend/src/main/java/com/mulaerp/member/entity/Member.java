package com.mulaerp.member.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Loyalty member for the PoS module. Points accrue on each sale (1 point per whole currency
 * unit of the sale's final total) and drive the tier/discountPercent, recomputed after every
 * accrual - see MemberService#accruePoints.
 */
@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Member extends BaseEntity {

    /** Auto-generated, e.g. "MBR-0001" - see MemberService#generateCode. */
    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true, length = 30)
    private String phone;

    private String email;

    @Column(nullable = false)
    private Integer points = 0;

    /** BASIC (default), SILVER (points >= 500), or GOLD (points >= 2000). */
    @Column(nullable = false, length = 20)
    private String tier = "BASIC";

    @Column(name = "discount_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercent = BigDecimal.ZERO;

    /** WP: store credit granted from trade-in payouts, redeemable against future PoS sales - see
     * MemberService#creditStoreCredit/#debitStoreCredit. */
    @Column(name = "store_credit_balance", nullable = false, precision = 15, scale = 2)
    private BigDecimal storeCreditBalance = BigDecimal.ZERO;
}
