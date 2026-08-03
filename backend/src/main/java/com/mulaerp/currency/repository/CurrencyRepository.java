package com.mulaerp.currency.repository;

import com.mulaerp.currency.entity.Currency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CurrencyRepository extends JpaRepository<Currency, java.util.UUID> {

    List<Currency> findByDeletedFalseOrderByCodeAsc();

    Optional<Currency> findByCodeIgnoreCaseAndDeletedFalse(@Param("code") String code);
}
