package com.mulaerp.email.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailTemplateService {

    private final EmailService emailService;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM dd, yyyy");

    @Value("${mulaerp.mail.admin-recipient:admin@mulaerp.com}")
    private String adminRecipient;

    @Value("${mulaerp.brand.name:Mula ERP}")
    private String brandName;

    public void sendLowStockAlert(String productName, String sku, int currentStock, int reorderLevel) {
        String subject = "⚠️ Low Stock Alert: " + productName;
        String body = buildLowStockTemplate(productName, sku, currentStock, reorderLevel);
        emailService.sendEmail(adminRecipient, subject, body);
        log.info("Sent low stock alert for product: {}", productName);
    }

    public void sendOrderConfirmation(String customerEmail, String customerName, String orderNumber, 
                                     double totalAmount, LocalDate orderDate) {
        String subject = "✅ Order Confirmation - " + orderNumber;
        String body = buildOrderConfirmationTemplate(customerName, orderNumber, totalAmount, orderDate);
        emailService.sendEmail(customerEmail, subject, body);
        log.info("Sent order confirmation to: {}", customerEmail);
    }

    public void sendInvoiceNotification(String customerEmail, String customerName, String invoiceNumber,
                                       double totalAmount, LocalDate dueDate) {
        String subject = "📄 New Invoice - " + invoiceNumber;
        String body = buildInvoiceTemplate(customerName, invoiceNumber, totalAmount, dueDate);
        emailService.sendEmail(customerEmail, subject, body);
        log.info("Sent invoice notification to: {}", customerEmail);
    }

    public void sendPaymentReceipt(String customerEmail, String customerName, String paymentNumber,
                                   double amount, LocalDate paymentDate, String paymentMethod) {
        String subject = "✅ Payment Receipt - " + paymentNumber;
        String body = buildPaymentReceiptTemplate(customerName, paymentNumber, amount, paymentDate, paymentMethod);
        emailService.sendEmail(customerEmail, subject, body);
        log.info("Sent payment receipt to: {}", customerEmail);
    }

    public void sendUserRegistration(String userEmail, String fullName, String role, String tempPassword) {
        String subject = "Welcome to " + brandName;
        String body = buildUserRegistrationTemplate(fullName, userEmail, role, tempPassword);
        emailService.sendEmail(userEmail, subject, body);
        log.info("Sent registration email to: {}", userEmail);
    }

    public void sendBatchExpiryAlert(String batchNumber, String productName, LocalDate expiryDate, int daysRemaining) {
        String subject = "⚠️ Batch Expiry Alert: " + batchNumber;
        String body = buildBatchExpiryTemplate(batchNumber, productName, expiryDate, daysRemaining);
        emailService.sendEmail(adminRecipient, subject, body);
        log.info("Sent batch expiry alert for: {}", batchNumber);
    }

    public void sendWarrantyExpiryAlert(String serialNumber, String productName, String customerName,
                                       LocalDate expiryDate, int daysRemaining) {
        String subject = "⚠️ Warranty Expiry Alert: " + serialNumber;
        String body = buildWarrantyExpiryTemplate(serialNumber, productName, customerName, expiryDate, daysRemaining);
        emailService.sendEmail(adminRecipient, subject, body);
        log.info("Sent warranty expiry alert for: {}", serialNumber);
    }

    // Template builders

    private String buildLowStockTemplate(String productName, String sku, int currentStock, int reorderLevel) {
        return String.format("""
            ⚠️ LOW STOCK ALERT
            
            Product: %s
            SKU: %s
            Current Stock: %d units
            Reorder Level: %d units
            
            Action Required: Please reorder this product to maintain adequate inventory levels.

            ---
            %s System
            """, productName, sku, currentStock, reorderLevel, brandName);
    }

    private String buildOrderConfirmationTemplate(String customerName, String orderNumber, 
                                                  double totalAmount, LocalDate orderDate) {
        return String.format("""
            Dear %s,
            
            Thank you for your order! We're pleased to confirm that we've received your order.
            
            Order Details:
            Order Number: %s
            Order Date: %s
            Total Amount: $%.2f
            
            We will notify you once your order is ready for delivery.
            
            If you have any questions, please don't hesitate to contact us.
            
            Best regards,
            %s Team
            """, customerName, orderNumber, orderDate.format(DATE_FORMATTER), totalAmount, brandName);
    }

    private String buildInvoiceTemplate(String customerName, String invoiceNumber, 
                                       double totalAmount, LocalDate dueDate) {
        return String.format("""
            Dear %s,
            
            A new invoice has been generated for your account.
            
            Invoice Details:
            Invoice Number: %s
            Total Amount: $%.2f
            Due Date: %s
            
            Please ensure payment is made by the due date to avoid any late fees.
            
            You can view the complete invoice details by logging into your account.
            
            Thank you for your business.
            
            Best regards,
            %s Team
            """, customerName, invoiceNumber, totalAmount, dueDate.format(DATE_FORMATTER), brandName);
    }

    private String buildPaymentReceiptTemplate(String customerName, String paymentNumber, 
                                              double amount, LocalDate paymentDate, String paymentMethod) {
        return String.format("""
            Dear %s,
            
            Thank you for your payment! This email confirms that we have received your payment.
            
            Payment Details:
            Payment Reference: %s
            Amount Paid: $%.2f
            Payment Date: %s
            Payment Method: %s
            
            Your account has been updated accordingly.
            
            If you have any questions about this payment, please contact us.
            
            Best regards,
            %s Team
            """, customerName, paymentNumber, amount, paymentDate.format(DATE_FORMATTER), paymentMethod, brandName);
    }

    private String buildUserRegistrationTemplate(String fullName, String email, String role, String tempPassword) {
        return String.format("""
            Welcome to %s!

            Dear %s,

            Your account has been created successfully.

            Login Credentials:
            Email: %s
            Temporary Password: %s
            Role: %s

            For security reasons, please change your password after your first login.

            You can access the system at: [Your ERP URL]

            If you have any questions, please contact your system administrator.

            Best regards,
            %s Team
            """, brandName, fullName, email, tempPassword, role, brandName);
    }

    private String buildBatchExpiryTemplate(String batchNumber, String productName, 
                                           LocalDate expiryDate, int daysRemaining) {
        return String.format("""
            ⚠️ BATCH EXPIRY ALERT
            
            Batch Number: %s
            Product: %s
            Expiry Date: %s
            Days Remaining: %d
            
            Action Required: Please review this batch and take appropriate action before expiry.

            ---
            %s System
            """, batchNumber, productName, expiryDate.format(DATE_FORMATTER), daysRemaining, brandName);
    }

    private String buildWarrantyExpiryTemplate(String serialNumber, String productName, String customerName,
                                              LocalDate expiryDate, int daysRemaining) {
        return String.format("""
            ⚠️ WARRANTY EXPIRY ALERT
            
            Serial Number: %s
            Product: %s
            Customer: %s
            Warranty Expiry: %s
            Days Remaining: %d
            
            Action Required: Consider contacting the customer about warranty renewal or extended coverage.

            ---
            %s System
            """, serialNumber, productName, customerName, expiryDate.format(DATE_FORMATTER), daysRemaining, brandName);
    }
}
