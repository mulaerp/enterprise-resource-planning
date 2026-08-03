package com.mulaerp.publicapi.service;

import com.mulaerp.currency.entity.Currency;
import com.mulaerp.currency.repository.CurrencyRepository;
import com.mulaerp.publicapi.dto.PublicCurrencyDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** PUBLIC-API: anonymous currency list, ordered by code (MYR first, alphabetically thereafter). */
@Service
@RequiredArgsConstructor
public class PublicCurrencyService {

    private final CurrencyRepository currencyRepository;

    @Transactional(readOnly = true)
    public List<PublicCurrencyDto> getAllCurrencies() {
        return currencyRepository.findByDeletedFalseOrderByCodeAsc().stream()
                .map(this::toDto)
                .toList();
    }

    private PublicCurrencyDto toDto(Currency currency) {
        return new PublicCurrencyDto(currency.getCode(), currency.getSymbol(), currency.getName(), currency.getRate());
    }
}
