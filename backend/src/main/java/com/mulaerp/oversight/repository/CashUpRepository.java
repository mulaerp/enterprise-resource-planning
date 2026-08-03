package com.mulaerp.oversight.repository;

import com.mulaerp.oversight.entity.CashUp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface CashUpRepository extends JpaRepository<CashUp, java.util.UUID> {

    List<CashUp> findByCashUpDateAndDeletedFalse(LocalDate cashUpDate);

    Optional<CashUp> findByCashUpDateAndPaymentMethodAndDeletedFalse(LocalDate cashUpDate, String paymentMethod);
}
