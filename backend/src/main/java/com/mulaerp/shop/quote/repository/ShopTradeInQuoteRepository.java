package com.mulaerp.shop.quote.repository;

import com.mulaerp.shop.quote.entity.ShopTradeInQuote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShopTradeInQuoteRepository extends JpaRepository<ShopTradeInQuote, UUID>,
        JpaSpecificationExecutor<ShopTradeInQuote> {

    Optional<ShopTradeInQuote> findByQuoteNumberAndDeletedFalse(String quoteNumber);

    Page<ShopTradeInQuote> findByShopCustomerIdAndDeletedFalse(UUID shopCustomerId, Pageable pageable);

    /** Backs ShopTradeInQuoteExpiryScheduler's sweep - only QUOTED rows past their own expiry are
     * ever touched (see the scheduler's javadoc for why every other status is left alone). */
    List<ShopTradeInQuote> findByStatusAndExpiresAtBeforeAndDeletedFalse(String status, LocalDateTime now);
}
