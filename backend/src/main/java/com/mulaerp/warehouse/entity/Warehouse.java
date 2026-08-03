package com.mulaerp.warehouse.entity;

import com.mulaerp.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "warehouses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Warehouse extends BaseEntity {

    /**
     * Code of the default warehouse that pre-multi-warehouse flows (stock adjustments with no
     * explicit warehouse, etc.) fall back to. Resolved by code rather than a hardcoded id
     * because the row's id is environment-specific (it was seeded by V2 with a random UUID on
     * most existing databases; V16 only guarantees a fixed id when no MAIN-coded row exists at
     * all - see V16__create_warehouses.sql).
     */
    public static final String DEFAULT_CODE = "MAIN";

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String location;

    @Column(nullable = false)
    private Boolean active = true;
}
