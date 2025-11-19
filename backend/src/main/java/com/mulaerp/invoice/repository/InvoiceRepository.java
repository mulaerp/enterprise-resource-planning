package com.mulaerp.invoice.repository;

import com.mulaerp.invoice.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    @Query("SELECT i FROM Invoice i WHERE " +
            "LOWER(i.invoiceNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(i.customer.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Invoice> searchInvoices(@Param("search") String search, Pageable pageable);

    Page<Invoice> findByStatus(Invoice.InvoiceStatus status, Pageable pageable);

    @Query("SELECT i FROM Invoice i WHERE i.status = 'SENT' AND i.dueDate < :date")
    List<Invoice> findOverdueInvoices(@Param("date") LocalDate date);
}
