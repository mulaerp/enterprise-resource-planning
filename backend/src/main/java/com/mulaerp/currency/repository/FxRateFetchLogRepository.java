package com.mulaerp.currency.repository;

import com.mulaerp.currency.entity.FxRateFetchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface FxRateFetchLogRepository extends JpaRepository<FxRateFetchLog, UUID> {
}
