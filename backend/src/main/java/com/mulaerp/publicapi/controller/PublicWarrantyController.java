package com.mulaerp.publicapi.controller;

import com.mulaerp.publicapi.dto.PublicWarrantyDto;
import com.mulaerp.publicapi.service.PublicWarrantyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * PUBLIC-API: anonymous (permitAll) warranty status lookup by warrantyNumber or serial number.
 * Always 200 with found:false rather than 404 - "unknown code" is a normal, expected result for
 * an anonymous lookup, not an error.
 */
@RestController
@RequestMapping("/api/v1/public/warranty")
@RequiredArgsConstructor
public class PublicWarrantyController {

    private final PublicWarrantyService publicWarrantyService;

    @GetMapping("/{code}")
    public ResponseEntity<PublicWarrantyDto> lookup(@PathVariable String code) {
        return ResponseEntity.ok(publicWarrantyService.lookup(code));
    }
}
