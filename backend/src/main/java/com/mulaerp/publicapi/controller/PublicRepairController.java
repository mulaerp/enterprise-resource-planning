package com.mulaerp.publicapi.controller;

import com.mulaerp.publicapi.dto.PublicRepairDto;
import com.mulaerp.publicapi.service.PublicRepairService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * PUBLIC-API: anonymous (permitAll) repair status lookup by jobNumber, mirroring
 * PublicWarrantyController's always-200 {found:...} contract - no customer PII exposed.
 */
@RestController
@RequestMapping("/api/v1/public/repairs")
@RequiredArgsConstructor
public class PublicRepairController {

    private final PublicRepairService publicRepairService;

    @GetMapping("/{jobNumber}")
    public ResponseEntity<PublicRepairDto> lookup(@PathVariable String jobNumber) {
        return ResponseEntity.ok(publicRepairService.lookup(jobNumber));
    }
}
