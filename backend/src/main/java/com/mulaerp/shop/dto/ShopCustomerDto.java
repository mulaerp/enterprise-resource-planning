package com.mulaerp.shop.dto;

import com.mulaerp.shop.entity.ShopCustomer;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Profile shape returned by register/login/me. Deliberately excludes passwordHash - never
 * serialize the ShopCustomer entity directly from a controller.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ShopCustomerDto {
    private UUID id;
    private String email;
    private String fullName;
    private String phone;
    private UUID memberId;
    private boolean emailVerified;
    private String status;
    private LocalDateTime createdAt;

    public static ShopCustomerDto fromEntity(ShopCustomer customer) {
        ShopCustomerDto dto = new ShopCustomerDto();
        dto.setId(customer.getId());
        dto.setEmail(customer.getEmail());
        dto.setFullName(customer.getFullName());
        dto.setPhone(customer.getPhone());
        dto.setMemberId(customer.getMemberId());
        dto.setEmailVerified(Boolean.TRUE.equals(customer.getEmailVerified()));
        dto.setStatus(customer.getStatus().name());
        dto.setCreatedAt(customer.getCreatedAt());
        return dto;
    }
}
