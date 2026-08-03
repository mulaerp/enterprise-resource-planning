package com.mulaerp.voucher.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "vouchers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Voucher extends BaseEntity {

    /** Always stored uppercase - see VoucherService#normalize. */
    @Column(nullable = false, unique = true, length = 50)
    private String code;

    /** PERCENT or FIXED. */
    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal value;

    @Column(name = "min_spend", precision = 15, scale = 2)
    private BigDecimal minSpend;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @Column(name = "usage_limit")
    private Integer usageLimit;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount = 0;

    @Column(nullable = false)
    private Boolean active = true;
}
