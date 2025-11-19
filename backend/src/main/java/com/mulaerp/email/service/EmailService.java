package com.mulaerp.email.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.from:noreply@mulaerp.com}")
    private String fromEmail;

    @Async
    public void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            
            mailSender.send(message);
            log.info("Email sent successfully to: {}", to);
        } catch (Exception e) {
            log.error("Failed to send email to: {}", to, e);
        }
    }

    public void sendLowStockAlert(String productName, int currentStock, int reorderLevel) {
        String subject = "Low Stock Alert: " + productName;
        String body = String.format(
            "Product '%s' is running low on stock.\n\n" +
            "Current Stock: %d\n" +
            "Reorder Level: %d\n\n" +
            "Please reorder this product soon.",
            productName, currentStock, reorderLevel
        );
        
        // Send to admin email - in production, get from settings
        sendEmail("admin@mulaerp.com", subject, body);
    }

    public void sendInvoiceNotification(String customerEmail, String invoiceNumber, String customerName) {
        String subject = "New Invoice: " + invoiceNumber;
        String body = String.format(
            "Dear %s,\n\n" +
            "A new invoice %s has been generated for your account.\n\n" +
            "Please log in to view the details.\n\n" +
            "Thank you for your business.",
            customerName, invoiceNumber
        );
        
        sendEmail(customerEmail, subject, body);
    }

    public void sendPaymentConfirmation(String customerEmail, String paymentNumber, String customerName, double amount) {
        String subject = "Payment Confirmation: " + paymentNumber;
        String body = String.format(
            "Dear %s,\n\n" +
            "We have received your payment of $%.2f.\n" +
            "Payment Reference: %s\n\n" +
            "Thank you for your payment.",
            customerName, amount, paymentNumber
        );
        
        sendEmail(customerEmail, subject, body);
    }

    public void sendOrderConfirmation(String customerEmail, String orderNumber, String customerName) {
        String subject = "Order Confirmation: " + orderNumber;
        String body = String.format(
            "Dear %s,\n\n" +
            "Your order %s has been confirmed.\n\n" +
            "We will notify you when it's ready for delivery.\n\n" +
            "Thank you for your order.",
            customerName, orderNumber
        );
        
        sendEmail(customerEmail, subject, body);
    }
}
