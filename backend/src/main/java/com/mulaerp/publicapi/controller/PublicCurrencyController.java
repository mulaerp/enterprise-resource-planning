package com.mulaerp.publicapi.controller;

import com.mulaerp.publicapi.dto.PublicCurrencyDto;
import com.mulaerp.publicapi.service.PublicCurrencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * PUBLIC-API: anonymous (permitAll, see SecurityConfig's "/api/v1/public/**" matcher) currency
 * list for the storefront's currency switcher.
 */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class PublicCurrencyController {

    private final PublicCurrencyService publicCurrencyService;

    @GetMapping("/currencies")
    public ResponseEntity<List<PublicCurrencyDto>> getCurrencies() {
        return ResponseEntity.ok(publicCurrencyService.getAllCurrencies());
    }
}
