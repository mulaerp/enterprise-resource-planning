package com.mulaerp.payment.repository;

import com.mulaerp.payment.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByPaymentNumber(String paymentNumber);

    List<Payment> findByInvoiceId(UUID invoiceId);

    @Query("SELECT p FROM Payment p WHERE " +
            "LOWER(p.paymentNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(p.invoice.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Payment> searchPayments(@Param("search") String search, Pageable pageable);

    Page<Payment> findByStatus(Payment.PaymentStatus status, Pageable pageable);
}
