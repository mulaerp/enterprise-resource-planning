package com.mulaerp.inventory.entity;

import com.mulaerp.common.entity.BaseEntity;
import com.mulaerp.product.entity.Product;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "product_serials")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class ProductSerial extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "serial_number", nullable = false, unique = true, length = 100)
    private String serialNumber;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "warranty_expiry_date")
    private LocalDate warrantyExpiryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private SerialStatus status = SerialStatus.IN_STOCK;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "sales_order_id")
    private UUID salesOrderId;

    @Column(name = "warehouse_id")
    private UUID warehouseId;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public enum SerialStatus {
        IN_STOCK,
        SOLD,
        RETURNED,
        DEFECTIVE,
        WARRANTY_CLAIM
    }
}
