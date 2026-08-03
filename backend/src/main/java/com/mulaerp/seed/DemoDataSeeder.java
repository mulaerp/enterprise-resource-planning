package com.mulaerp.seed;

import com.mulaerp.customer.dto.CreateCustomerRequest;
import com.mulaerp.customer.dto.CustomerDto;
import com.mulaerp.customer.service.CustomerService;
import com.mulaerp.inventory.dto.StockAdjustmentDTO;
import com.mulaerp.inventory.entity.StockAdjustment;
import com.mulaerp.inventory.service.InventoryService;
import com.mulaerp.invoice.dto.CreateInvoiceRequest;
import com.mulaerp.invoice.dto.InvoiceDTO;
import com.mulaerp.invoice.entity.Invoice;
import com.mulaerp.invoice.service.InvoiceService;
import com.mulaerp.member.dto.CreateMemberRequest;
import com.mulaerp.member.dto.MemberDto;
import com.mulaerp.member.service.MemberService;
import com.mulaerp.payment.dto.CreatePaymentRequest;
import com.mulaerp.payment.entity.Payment;
import com.mulaerp.payment.service.PaymentService;
import com.mulaerp.pos.dto.CreatePosSaleRequest;
import com.mulaerp.pos.service.PosSaleService;
import com.mulaerp.product.dto.CreateProductRequest;
import com.mulaerp.product.dto.ProductDto;
import com.mulaerp.product.entity.ProductCategory;
import com.mulaerp.product.repository.ProductCategoryRepository;
import com.mulaerp.product.repository.ProductRepository;
import com.mulaerp.product.service.ProductService;
import com.mulaerp.purchase.dto.CreatePurchaseOrderRequest;
import com.mulaerp.purchase.dto.PurchaseOrderDTO;
import com.mulaerp.purchase.dto.ReceivePurchaseOrderRequest;
import com.mulaerp.purchase.entity.PurchaseOrder;
import com.mulaerp.purchase.service.PurchaseOrderService;
import com.mulaerp.sales.dto.CreateSalesOrderRequest;
import com.mulaerp.sales.dto.SalesOrderDto;
import com.mulaerp.sales.service.SalesOrderService;
import com.mulaerp.supplier.dto.CreateSupplierRequest;
import com.mulaerp.supplier.dto.SupplierDto;
import com.mulaerp.supplier.service.SupplierService;
import com.mulaerp.voucher.dto.CreateVoucherRequest;
import com.mulaerp.voucher.dto.VoucherDto;
import com.mulaerp.voucher.service.VoucherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * WP10: seeds a small, entirely synthetic thrift-store demo dataset through the normal service
 * layer (never raw SQL), so the audit listener, the append-only stock movement ledger, and the
 * auto-journal hooks (invoice/payment/PoS) all stay consistent - exactly as if a human had
 * clicked through the UI.
 *
 * <p>Disabled by default. Enable for a local/demo environment only via {@code SEED_DEMO_DATA=true}
 * (see {@code mulaerp.seed.demo-data} in application.yml).
 *
 * <p>Idempotent: the very first thing this does is check whether product SKU {@value
 * #SENTINEL_SKU} already exists - if it does, the whole run is skipped (no duplicate categories,
 * customers, orders, etc. on every restart with the flag left on).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "mulaerp.seed", name = "demo-data", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final String SENTINEL_SKU = "DEMO-0001";

    private final ProductRepository productRepository;
    private final ProductCategoryRepository categoryRepository;
    private final ProductService productService;
    private final InventoryService inventoryService;
    private final CustomerService customerService;
    private final SupplierService supplierService;
    private final MemberService memberService;
    private final VoucherService voucherService;
    private final SalesOrderService salesOrderService;
    private final PurchaseOrderService purchaseOrderService;
    private final InvoiceService invoiceService;
    private final PaymentService paymentService;
    private final PosSaleService posSaleService;

    @Override
    public void run(ApplicationArguments args) {
        try {
            if (productRepository.findBySkuAndDeletedFalse(SENTINEL_SKU).isPresent()) {
                log.info("[DemoDataSeeder] Sentinel product {} already exists - demo data already "
                        + "seeded, skipping.", SENTINEL_SKU);
                return;
            }

            log.info("[DemoDataSeeder] SEED_DEMO_DATA=true and no sentinel product found - seeding "
                    + "synthetic demo data...");

            List<ProductCategory> categories = seedCategories();
            List<ProductDto> products = seedProducts(categories);
            List<CustomerDto> customers = seedCustomers();
            List<SupplierDto> suppliers = seedSuppliers();
            List<MemberDto> members = seedMembers();
            List<VoucherDto> vouchers = seedVouchers();
            List<SalesOrderDto> salesOrders = seedSalesOrders(customers, products);
            List<PurchaseOrderDTO> purchaseOrders = seedPurchaseOrders(suppliers, products);
            List<InvoiceDTO> invoices = seedInvoicesAndPayments(customers, products);
            int posSales = seedPosSales(products, members, vouchers);

            log.info("[DemoDataSeeder] Done - seeded {} categories, {} products, {} customers, "
                            + "{} suppliers, {} members, {} vouchers, {} sales orders, {} purchase "
                            + "orders, {} invoices, {} PoS sales.",
                    categories.size(), products.size(), customers.size(), suppliers.size(),
                    members.size(), vouchers.size(), salesOrders.size(), purchaseOrders.size(),
                    invoices.size(), posSales);
        } catch (Exception e) {
            // A seeding bug must never take the whole backend down on startup.
            log.error("[DemoDataSeeder] Demo data seeding failed - backend will continue starting "
                    + "up without (all of) the demo data.", e);
        }
    }

    // ---------------------------------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------------------------------

    private List<ProductCategory> seedCategories() {
        ProductCategory apparel = new ProductCategory();
        apparel.setName("Vintage Apparel");
        apparel.setDescription("Pre-loved clothing and accessories");
        apparel = categoryRepository.save(apparel);

        ProductCategory general = new ProductCategory();
        general.setName("General Merchandise");
        general.setDescription("New everyday household and lifestyle goods");
        general = categoryRepository.save(general);

        return List.of(apparel, general);
    }

    // ---------------------------------------------------------------------------------------
    // Products (~15) + initial stock via adjustments so the movement ledger is populated
    // ---------------------------------------------------------------------------------------

    private List<ProductDto> seedProducts(List<ProductCategory> categories) {
        UUID apparelId = categories.get(0).getId();
        UUID generalId = categories.get(1).getId();

        List<ProductDto> products = new java.util.ArrayList<>();

        // Thrift items - condition/tags/acquisitionCost/hasBox populated.
        products.add(seedThriftProduct("DEMO-0001", "Vintage Denim Jacket",
                "Faded straight-cut denim jacket, machine washed and mended cuffs.", apparelId,
                "45.00", "20.00", 3, "GOOD", "15.00", List.of("jacket", "denim", "retro"), false, 12));
        products.add(seedThriftProduct("DEMO-0002", "Retro Floral Dress",
                "Knee-length floral print dress, 1970s inspired cut.", apparelId,
                "28.00", "10.00", 3, "LIKE_NEW", "8.00", List.of("dress", "floral"), false, 8));
        products.add(seedThriftProduct("DEMO-0003", "Classic Leather Belt",
                "Genuine leather belt, brass buckle, some surface wear.", apparelId,
                "12.00", "5.00", 5, "FAIR", "3.50", List.of("accessory", "leather"), false, 20));
        products.add(seedThriftProduct("DEMO-0004", "Wool Blend Overcoat",
                "Charcoal wool-blend overcoat, dry-cleaned, size M.", apparelId,
                "60.00", "25.00", 2, "GOOD", "22.00", List.of("coat", "wool", "winter"), false, 5));
        products.add(seedThriftProduct("DEMO-0005", "Striped Cotton Shirt",
                "Lightweight striped cotton button-down.", apparelId,
                "18.00", "7.00", 4, "LIKE_NEW", "5.00", List.of("shirt", "cotton"), false, 15));
        products.add(seedThriftProduct("DEMO-0006", "Corduroy Trousers",
                "Straight-leg corduroy trousers, tan.", apparelId,
                "22.00", "9.00", 4, "GOOD", "6.50", List.of("trousers", "corduroy"), false, 10));
        products.add(seedThriftProduct("DEMO-0007", "Silk Scarf Gift Set",
                "Boxed set of two silk scarves, unused.", apparelId,
                "15.00", "6.00", 5, "NEW", "4.00", List.of("scarf", "silk", "accessory"), true, 18));
        products.add(seedThriftProduct("DEMO-0008", "Suede Ankle Boots",
                "Suede ankle boots with original box, light scuffing.", apparelId,
                "35.00", "15.00", 3, "FAIR", "12.00", List.of("shoes", "suede"), true, 6));

        // Regular (non-thrift) merchandise - no condition/tags/acquisitionCost/hasBox.
        products.add(seedRegularProduct("DEMO-0009", "Ceramic Mug Set", "Set of 4 glazed ceramic mugs.",
                generalId, "14.00", "6.00", 10, 40));
        products.add(seedRegularProduct("DEMO-0010", "Canvas Tote Bag", "Heavy-duty plain canvas tote bag.",
                generalId, "16.00", "7.00", 8, 30));
        products.add(seedRegularProduct("DEMO-0011", "Wireless Desk Lamp", "USB-rechargeable dimmable desk lamp.",
                generalId, "32.00", "18.00", 3, 14));
        products.add(seedRegularProduct("DEMO-0012", "Bamboo Cutting Board", "Solid bamboo cutting board, medium.",
                generalId, "20.00", "9.00", 5, 25));
        products.add(seedRegularProduct("DEMO-0013", "Stainless Steel Water Bottle",
                "Insulated 750ml stainless steel bottle.", generalId, "18.00", "8.00", 8, 35));
        products.add(seedRegularProduct("DEMO-0014", "Recycled Notebook Set", "Pack of 3 recycled-paper notebooks.",
                generalId, "10.00", "4.00", 10, 50));
        products.add(seedRegularProduct("DEMO-0015", "Woven Storage Basket", "Hand-woven seagrass storage basket.",
                generalId, "24.00", "11.00", 5, 20));

        return products;
    }

    private ProductDto seedThriftProduct(String sku, String name, String description, UUID categoryId,
                                          String unitPrice, String costPrice, int reorderLevel,
                                          String condition, String acquisitionCost, List<String> tags,
                                          boolean hasBox, int initialStock) {
        CreateProductRequest request = new CreateProductRequest();
        request.setSku(sku);
        request.setName(name);
        request.setDescription(description);
        request.setCategoryId(categoryId);
        request.setUnitPrice(new BigDecimal(unitPrice));
        request.setCostPrice(new BigDecimal(costPrice));
        request.setStockQuantity(0); // opening balance is applied via a stock adjustment below
        request.setReorderLevel(reorderLevel);
        request.setStatus("ACTIVE");
        request.setCondition(condition);
        request.setAcquisitionCost(new BigDecimal(acquisitionCost));
        request.setTags(tags);
        request.setHasBox(hasBox);

        ProductDto product = productService.createProduct(request);
        seedInitialStock(product.getId(), initialStock);
        return product;
    }

    private ProductDto seedRegularProduct(String sku, String name, String description, UUID categoryId,
                                           String unitPrice, String costPrice, int reorderLevel,
                                           int initialStock) {
        CreateProductRequest request = new CreateProductRequest();
        request.setSku(sku);
        request.setName(name);
        request.setDescription(description);
        request.setCategoryId(categoryId);
        request.setUnitPrice(new BigDecimal(unitPrice));
        request.setCostPrice(new BigDecimal(costPrice));
        request.setStockQuantity(0);
        request.setReorderLevel(reorderLevel);
        request.setStatus("ACTIVE");

        ProductDto product = productService.createProduct(request);
        seedInitialStock(product.getId(), initialStock);
        return product;
    }

    /** Records the opening stock balance as an INCREASE adjustment, so a ledger movement exists. */
    private void seedInitialStock(UUID productId, int quantity) {
        StockAdjustmentDTO adjustment = new StockAdjustmentDTO();
        adjustment.setProductId(productId);
        adjustment.setAdjustmentType(StockAdjustment.AdjustmentType.INCREASE);
        adjustment.setQuantityAdjusted(quantity);
        adjustment.setReason("Initial demo stock");
        adjustment.setNotes("Seeded by DemoDataSeeder (WP10)");
        adjustment.setAdjustmentDate(LocalDate.now());
        throttleForSecondPrecisionSequenceNumbers();
        inventoryService.createAdjustment(adjustment);
    }

    // ---------------------------------------------------------------------------------------
    // InventoryService#createAdjustment() and SalesOrderService#createSalesOrder() both derive
    // their unique number from a second-precision timestamp (ADJ-/SO-yyyyMMddHHmmss). Called
    // back-to-back in a tight loop, several of this seeder's products/orders land in the same
    // wall-clock second and collide on that unique DB constraint. Fixing the generators
    // themselves is out of scope here (this seeder may only touch the seed package + the
    // product/customer import endpoints, not other services), so instead this seeder simply
    // never calls either generator twice within the same second.
    // ---------------------------------------------------------------------------------------

    private long lastThrottledEpochSecond = -1;

    private void throttleForSecondPrecisionSequenceNumbers() {
        long nowSecond = System.currentTimeMillis() / 1000;
        if (nowSecond == lastThrottledEpochSecond) {
            try {
                long millisToNextSecond = 1000 - (System.currentTimeMillis() % 1000) + 20;
                Thread.sleep(millisToNextSecond);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        lastThrottledEpochSecond = System.currentTimeMillis() / 1000;
    }

    // ---------------------------------------------------------------------------------------
    // Customers (~8)
    // ---------------------------------------------------------------------------------------

    private List<CustomerDto> seedCustomers() {
        String[][] rows = {
                {"Walter Example", "walter.example@example.test", "+1-555-0101"},
                {"Priya Example", "priya.example@example.test", "+1-555-0102"},
                {"Noah Example", "noah.example@example.test", "+1-555-0103"},
                {"Aisha Example", "aisha.example@example.test", "+1-555-0104"},
                {"Liam Example", "liam.example@example.test", "+1-555-0105"},
                {"Sofia Example", "sofia.example@example.test", "+1-555-0106"},
                {"Kenji Example", "kenji.example@example.test", "+1-555-0107"},
                {"Grace Example", "grace.example@example.test", "+1-555-0108"},
        };

        List<CustomerDto> customers = new java.util.ArrayList<>();
        int i = 1;
        for (String[] row : rows) {
            CreateCustomerRequest request = new CreateCustomerRequest();
            request.setName(row[0]);
            request.setEmail(row[1]);
            request.setPhone(row[2]);
            request.setAddress(i + " Example Lane, Demo City");
            request.setCreditLimit(BigDecimal.valueOf(500));
            request.setStatus("ACTIVE");
            customers.add(customerService.createCustomer(request));
            i++;
        }
        return customers;
    }

    // ---------------------------------------------------------------------------------------
    // Suppliers (~3)
    // ---------------------------------------------------------------------------------------

    private List<SupplierDto> seedSuppliers() {
        List<SupplierDto> suppliers = new java.util.ArrayList<>();

        suppliers.add(seedSupplier("Example Textile Supply Co.", "contact@exampletextile.test",
                "+1-555-0201", "NET30"));
        suppliers.add(seedSupplier("Demo Wholesale Traders", "sales@demowholesale.test",
                "+1-555-0202", "NET15"));
        suppliers.add(seedSupplier("Sample Goods Distribution", "orders@samplegoods.test",
                "+1-555-0203", "NET45"));

        return suppliers;
    }

    private SupplierDto seedSupplier(String name, String email, String phone, String paymentTerms) {
        CreateSupplierRequest request = new CreateSupplierRequest();
        request.setName(name);
        request.setEmail(email);
        request.setPhone(phone);
        request.setAddress("1 Demo Industrial Estate, Demo City");
        request.setPaymentTerms(paymentTerms);
        request.setStatus("ACTIVE");
        return supplierService.createSupplier(request);
    }

    // ---------------------------------------------------------------------------------------
    // Members (~5), spread across BASIC/SILVER/GOLD tiers via points accrual
    // ---------------------------------------------------------------------------------------

    private List<MemberDto> seedMembers() {
        List<MemberDto> members = new java.util.ArrayList<>();

        members.add(seedMember("Ivy Example", "+1-555-0301", "ivy.example@example.test", 0));
        members.add(seedMember("Marco Example", "+1-555-0302", "marco.example@example.test", 650));
        members.add(seedMember("Chen Example", "+1-555-0303", "chen.example@example.test", 2500));
        members.add(seedMember("Olivia Example", "+1-555-0304", "olivia.example@example.test", 120));
        members.add(seedMember("Ravi Example", "+1-555-0305", "ravi.example@example.test", 800));

        return members;
    }

    private MemberDto seedMember(String name, String phone, String email, int pointsToAccrue) {
        CreateMemberRequest request = new CreateMemberRequest();
        request.setName(name);
        request.setPhone(phone);
        request.setEmail(email);
        MemberDto member = memberService.createMember(request);
        if (pointsToAccrue > 0) {
            member = memberService.accruePoints(member.getId(), pointsToAccrue);
        }
        return member;
    }

    // ---------------------------------------------------------------------------------------
    // Vouchers (~3): percent, fixed, and one already expired
    // ---------------------------------------------------------------------------------------

    private List<VoucherDto> seedVouchers() {
        List<VoucherDto> vouchers = new java.util.ArrayList<>();

        vouchers.add(seedVoucher("WELCOME10", "PERCENT", "10", "20.00",
                LocalDate.now().plusDays(90), 200, true));
        vouchers.add(seedVoucher("FIVEOFF", "FIXED", "5.00", "15.00",
                LocalDate.now().plusDays(60), 100, true));
        vouchers.add(seedVoucher("SUMMER20", "PERCENT", "20", null,
                LocalDate.now().minusDays(30), 50, true)); // expired

        return vouchers;
    }

    private VoucherDto seedVoucher(String code, String type, String value, String minSpend,
                                    LocalDate expiresAt, int usageLimit, boolean active) {
        CreateVoucherRequest request = new CreateVoucherRequest();
        request.setCode(code);
        request.setType(type);
        request.setValue(new BigDecimal(value));
        request.setMinSpend(minSpend != null ? new BigDecimal(minSpend) : null);
        request.setExpiresAt(expiresAt);
        request.setUsageLimit(usageLimit);
        request.setActive(active);
        return voucherService.createVoucher(request);
    }

    // ---------------------------------------------------------------------------------------
    // Sales orders (~4) across different statuses: DRAFT, CONFIRMED, DELIVERED, CANCELLED
    // ---------------------------------------------------------------------------------------

    private List<SalesOrderDto> seedSalesOrders(List<CustomerDto> customers, List<ProductDto> products) {
        List<SalesOrderDto> orders = new java.util.ArrayList<>();

        SalesOrderDto draft = createSalesOrder(customers.get(0).getId(), products.get(0), 1);
        orders.add(draft); // left as DRAFT

        SalesOrderDto confirmed = createSalesOrder(customers.get(1).getId(), products.get(8), 2);
        confirmed = salesOrderService.updateOrderStatus(UUID.fromString(confirmed.getId()), "CONFIRMED");
        orders.add(confirmed);

        SalesOrderDto delivered = createSalesOrder(customers.get(2).getId(), products.get(9), 1);
        delivered = salesOrderService.updateOrderStatus(UUID.fromString(delivered.getId()), "DELIVERED");
        orders.add(delivered);

        SalesOrderDto cancelled = createSalesOrder(customers.get(3).getId(), products.get(3), 1);
        cancelled = salesOrderService.updateOrderStatus(UUID.fromString(cancelled.getId()), "CANCELLED");
        orders.add(cancelled);

        return orders;
    }

    private SalesOrderDto createSalesOrder(UUID customerId, ProductDto product, int quantity) {
        CreateSalesOrderRequest.CreateSalesOrderItemRequest itemRequest =
                new CreateSalesOrderRequest.CreateSalesOrderItemRequest();
        itemRequest.setProductId(product.getId());
        itemRequest.setQuantity(quantity);
        itemRequest.setUnitPrice(product.getUnitPrice());
        itemRequest.setDiscount(BigDecimal.ZERO);
        itemRequest.setTaxRate(BigDecimal.ZERO);

        CreateSalesOrderRequest request = new CreateSalesOrderRequest();
        request.setCustomerId(customerId);
        request.setOrderDate(LocalDate.now());
        request.setDeliveryDate(LocalDate.now().plusDays(7));
        request.setTax(BigDecimal.ZERO);
        request.setNotes("Demo seed order");
        request.setItems(List.of(itemRequest));

        throttleForSecondPrecisionSequenceNumbers();
        return salesOrderService.createSalesOrder(request);
    }

    // ---------------------------------------------------------------------------------------
    // Purchase orders (~2): one received with a batch, one left un-received
    // ---------------------------------------------------------------------------------------

    private List<PurchaseOrderDTO> seedPurchaseOrders(List<SupplierDto> suppliers, List<ProductDto> products) {
        List<PurchaseOrderDTO> orders = new java.util.ArrayList<>();

        // PO1: received, and the receipt creates a batch for the replenished product.
        ProductDto restockedProduct = products.get(3); // DEMO-0004 Wool Blend Overcoat
        CreatePurchaseOrderRequest.PurchaseOrderItemRequest po1Item =
                new CreatePurchaseOrderRequest.PurchaseOrderItemRequest();
        po1Item.setProductId(restockedProduct.getId());
        po1Item.setQuantity(10);
        po1Item.setUnitPrice(restockedProduct.getCostPrice());
        po1Item.setTaxRate(BigDecimal.ZERO);

        CreatePurchaseOrderRequest po1Request = new CreatePurchaseOrderRequest();
        po1Request.setSupplierId(suppliers.get(0).getId());
        po1Request.setOrderDate(LocalDate.now().minusDays(5));
        po1Request.setExpectedDate(LocalDate.now());
        po1Request.setTax(BigDecimal.ZERO);
        po1Request.setNotes("Demo seed purchase order - received with batch tracking");
        po1Request.setItems(List.of(po1Item));

        PurchaseOrderDTO po1 = purchaseOrderService.createPurchaseOrder(po1Request);

        ReceivePurchaseOrderRequest.ItemTracking tracking = new ReceivePurchaseOrderRequest.ItemTracking();
        tracking.setItemId(po1.getItems().get(0).getId());
        tracking.setBatchNumber("BATCH-DEMO-0004-01");
        tracking.setManufactureDate(LocalDate.now().minusMonths(6));
        tracking.setExpiryDate(null);

        ReceivePurchaseOrderRequest receiveRequest = new ReceivePurchaseOrderRequest();
        receiveRequest.setItems(List.of(tracking));

        po1 = purchaseOrderService.updateStatus(po1.getId(), PurchaseOrder.PurchaseOrderStatus.RECEIVED, receiveRequest);
        orders.add(po1);

        // PO2: sent to the supplier, not yet received.
        ProductDto secondProduct = products.get(10); // DEMO-0011 Wireless Desk Lamp
        CreatePurchaseOrderRequest.PurchaseOrderItemRequest po2Item =
                new CreatePurchaseOrderRequest.PurchaseOrderItemRequest();
        po2Item.setProductId(secondProduct.getId());
        po2Item.setQuantity(15);
        po2Item.setUnitPrice(secondProduct.getCostPrice());
        po2Item.setTaxRate(BigDecimal.ZERO);

        CreatePurchaseOrderRequest po2Request = new CreatePurchaseOrderRequest();
        po2Request.setSupplierId(suppliers.get(1).getId());
        po2Request.setOrderDate(LocalDate.now().minusDays(2));
        po2Request.setExpectedDate(LocalDate.now().plusDays(5));
        po2Request.setTax(BigDecimal.ZERO);
        po2Request.setNotes("Demo seed purchase order - awaiting receipt");
        po2Request.setItems(List.of(po2Item));

        PurchaseOrderDTO po2 = purchaseOrderService.createPurchaseOrder(po2Request);
        po2 = purchaseOrderService.updateStatus(po2.getId(), PurchaseOrder.PurchaseOrderStatus.SENT);
        orders.add(po2);

        return orders;
    }

    // ---------------------------------------------------------------------------------------
    // Invoices (~3): one left unpaid (DRAFT), one SENT, one paid in full (triggers auto-journal)
    // ---------------------------------------------------------------------------------------

    private List<InvoiceDTO> seedInvoicesAndPayments(List<CustomerDto> customers, List<ProductDto> products) {
        List<InvoiceDTO> invoices = new java.util.ArrayList<>();

        InvoiceDTO unpaid = createInvoice(customers.get(0).getId(), products.get(0), 1);
        invoices.add(unpaid); // left DRAFT / unpaid

        InvoiceDTO sent = createInvoice(customers.get(1).getId(), products.get(8), 3);
        sent = invoiceService.updateStatus(sent.getId(), Invoice.InvoiceStatus.SENT);
        invoices.add(sent);

        InvoiceDTO paid = createInvoice(customers.get(2).getId(), products.get(9), 2);
        CreatePaymentRequest paymentRequest = new CreatePaymentRequest();
        paymentRequest.setInvoiceId(paid.getId());
        paymentRequest.setPaymentDate(LocalDate.now());
        paymentRequest.setAmount(paid.getTotal());
        paymentRequest.setMethod(Payment.PaymentMethod.CASH);
        paymentRequest.setReference("DEMO-PAYMENT-01");
        paymentRequest.setNotes("Demo seed payment - paid in full");
        paymentService.createPayment(paymentRequest);
        paid = invoiceService.getInvoiceById(paid.getId());
        invoices.add(paid);

        return invoices;
    }

    private InvoiceDTO createInvoice(UUID customerId, ProductDto product, int quantity) {
        CreateInvoiceRequest.InvoiceItemRequest itemRequest = new CreateInvoiceRequest.InvoiceItemRequest();
        itemRequest.setProductId(product.getId());
        itemRequest.setDescription(product.getName());
        itemRequest.setQuantity(quantity);
        itemRequest.setUnitPrice(product.getUnitPrice());
        itemRequest.setTaxRate(BigDecimal.ZERO);

        CreateInvoiceRequest request = new CreateInvoiceRequest();
        request.setCustomerId(customerId);
        request.setInvoiceDate(LocalDate.now());
        request.setDueDate(LocalDate.now().plusDays(30));
        request.setTax(BigDecimal.ZERO);
        request.setNotes("Demo seed invoice");
        request.setItems(List.of(itemRequest));

        return invoiceService.createInvoice(request);
    }

    // ---------------------------------------------------------------------------------------
    // PoS sales (~2): one with a member discount, one with a voucher redemption
    // ---------------------------------------------------------------------------------------

    private int seedPosSales(List<ProductDto> products, List<MemberDto> members, List<VoucherDto> vouchers) {
        // Sale 1: SILVER member (5% discount) buying water bottles, no voucher.
        ProductDto waterBottle = products.get(12); // DEMO-0013
        CreatePosSaleRequest.PosSaleLineRequest line1 = new CreatePosSaleRequest.PosSaleLineRequest();
        line1.setProductId(waterBottle.getId());
        line1.setQuantity(2);
        line1.setUnitPrice(waterBottle.getUnitPrice());
        line1.setLineDiscount(BigDecimal.ZERO);

        CreatePosSaleRequest sale1 = new CreatePosSaleRequest();
        sale1.setClientSaleId("demo-seed-" + UUID.randomUUID());
        sale1.setMemberId(members.get(1).getId()); // Marco Example, SILVER
        sale1.setPaymentMethod("CASH");
        sale1.setAmountTendered(BigDecimal.valueOf(40));
        sale1.setLines(List.of(line1));
        posSaleService.createSale(sale1);

        // Sale 2: fixed-value voucher redemption, no member.
        ProductDto notebookSet = products.get(13); // DEMO-0014
        CreatePosSaleRequest.PosSaleLineRequest line2 = new CreatePosSaleRequest.PosSaleLineRequest();
        line2.setProductId(notebookSet.getId());
        line2.setQuantity(3);
        line2.setUnitPrice(notebookSet.getUnitPrice());
        line2.setLineDiscount(BigDecimal.ZERO);

        CreatePosSaleRequest sale2 = new CreatePosSaleRequest();
        sale2.setClientSaleId("demo-seed-" + UUID.randomUUID());
        sale2.setVoucherCode(vouchers.get(1).getCode()); // FIVEOFF
        sale2.setPaymentMethod("CASH");
        sale2.setAmountTendered(BigDecimal.valueOf(30));
        sale2.setLines(List.of(line2));
        posSaleService.createSale(sale2);

        return 2;
    }
}
