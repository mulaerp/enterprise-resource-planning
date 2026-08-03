package com.mulaerp.shop.order.repository;

import com.mulaerp.shop.order.entity.ShopOrder;
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
public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID>, JpaSpecificationExecutor<ShopOrder> {

    Page<ShopOrder> findByShopCustomerId(UUID shopCustomerId, Pageable pageable);

    Optional<ShopOrder> findByIdAndShopCustomerId(UUID id, UUID shopCustomerId);

    Optional<ShopOrder> findByOrderNumberAndGuestEmailIgnoreCase(String orderNumber, String guestEmail);

    Optional<ShopOrder> findByOrderNumber(String orderNumber);

    /** Read by the release job (ShopOrderService#releaseExpiredReservations) - every order still
     * holding stock hostage past its reservation window. */
    List<ShopOrder> findByStatusInAndReservedUntilBefore(List<ShopOrder.OrderStatus> statuses, LocalDateTime cutoff);

    /** Read by {@code MoneyFlowService#buildCrossCheck} (WEBSHOP verification-gate fix) - a
     * FULFILLED order posts its Sales Revenue (4100) credit at the moment of fulfilment
     * ({@code ShopOrderService#fulfilOrder}), not at placement, so this is filtered on
     * {@code updatedAt} (the fulfilment write, since {@code ShopOrder} has no dedicated
     * {@code fulfilledAt} column) rather than {@code createdAt} (reservation time). */
    List<ShopOrder> findByStatusAndUpdatedAtBetween(ShopOrder.OrderStatus status, LocalDateTime start, LocalDateTime end);
}
