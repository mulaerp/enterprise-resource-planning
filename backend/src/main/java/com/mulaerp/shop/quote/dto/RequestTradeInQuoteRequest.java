package com.mulaerp.shop.quote.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

/**
 * Request body for {@code POST /api/v1/shop/quotes} (the ONLY remaining quote-creation endpoint -
 * see {@code ShopTradeInQuoteService}'s class javadoc "Members-only" section for why the previous
 * guest path, {@code POST /api/v1/public/shop/quotes}, was removed rather than kept permitAll).
 * The caller is always a logged-in {@code ROLE_SHOP_CUSTOMER} session - {@code
 * ShopQuoteController} auto-attaches {@code shopCustomerId} from that session, so this request
 * body carries no guest contact fields at all any more. The service still enforces "exactly one
 * of productId or categoryId" itself (not bean validation, since that cross-field rule needs
 * custom logic either way).
 */
@Data
public class RequestTradeInQuoteRequest {

    /** An existing catalogue item the customer picked - when set, pricing bases off that
     * product's buyPrice/unitPrice (see ShopTradeInQuoteService#computeRange). */
    private UUID productId;

    /** Required when productId is absent - the customer's own words about the item. */
    private String freeTextDescription;

    /** Required when productId is absent - which category the free-text item belongs to. */
    private UUID categoryId;

    @NotBlank(message = "declaredCondition is required")
    private String declaredCondition;

    private Boolean hasBox;

    private String accessories;

    @NotBlank(message = "deliveryMethod is required")
    private String deliveryMethod;
}
