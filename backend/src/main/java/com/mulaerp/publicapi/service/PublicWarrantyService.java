package com.mulaerp.publicapi.service;

import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.repository.ProductSerialRepository;
import com.mulaerp.publicapi.dto.PublicWarrantyDto;
import com.mulaerp.warranty.dto.WarrantyDto;
import com.mulaerp.warranty.entity.Warranty;
import com.mulaerp.warranty.repository.WarrantyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * PUBLIC-API: anonymous warranty status lookup by warrantyNumber OR a serial number - never
 * exposes customer/member PII (see #toDto, which only ever reads status/productName/dates off
 * Warranty, never customerId/memberId).
 */
@Service
@RequiredArgsConstructor
public class PublicWarrantyService {

    private final WarrantyRepository warrantyRepository;
    private final ProductSerialRepository productSerialRepository;

    @Transactional(readOnly = true)
    public PublicWarrantyDto lookup(String code) {
        if (code == null || code.isBlank()) {
            return PublicWarrantyDto.notFound();
        }

        Optional<Warranty> byNumber = warrantyRepository.findByWarrantyNumberAndDeletedFalse(code.trim());
        if (byNumber.isPresent()) {
            return toDto(byNumber.get());
        }

        Optional<ProductSerial> serial = productSerialRepository.findBySerialNumber(code.trim());
        if (serial.isPresent()) {
            Optional<Warranty> bySerial = warrantyRepository.findBySerialIdAndDeletedFalse(serial.get().getId());
            if (bySerial.isPresent()) {
                return toDto(bySerial.get());
            }
        }

        return PublicWarrantyDto.notFound();
    }

    private PublicWarrantyDto toDto(Warranty warranty) {
        long remainingDays = ChronoUnit.DAYS.between(LocalDate.now(), warranty.getExpiryDate());
        return new PublicWarrantyDto(
                true,
                warranty.getStatus().name(),
                warranty.getProductName(),
                warranty.getStartDate(),
                warranty.getExpiryDate(),
                remainingDays,
                WarrantyDto.coverageLabel(warranty)
        );
    }
}
