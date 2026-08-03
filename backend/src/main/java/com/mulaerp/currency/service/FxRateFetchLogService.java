package com.mulaerp.currency.service;

import com.mulaerp.currency.dto.FxRateFetchLogDto;
import com.mulaerp.currency.repository.FxRateFetchLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-side of the fetch log - see {@link FxRateRefreshService} for the write side. */
@Service
@RequiredArgsConstructor
public class FxRateFetchLogService {

    private final FxRateFetchLogRepository fetchLogRepository;

    @Transactional(readOnly = true)
    public Page<FxRateFetchLogDto> getFetchLog(Pageable pageable) {
        return fetchLogRepository.findAll(pageable).map(FxRateFetchLogDto::fromEntity);
    }
}
