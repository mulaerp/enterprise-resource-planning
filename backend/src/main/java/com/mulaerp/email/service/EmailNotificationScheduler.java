package com.mulaerp.email.service;

import com.mulaerp.inventory.entity.ProductBatch;
import com.mulaerp.inventory.entity.ProductSerial;
import com.mulaerp.inventory.repository.ProductBatchRepository;
import com.mulaerp.inventory.repository.ProductSerialRepository;
import com.mulaerp.product.entity.Product;
import com.mulaerp.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailNotificationScheduler {

    private final ProductRepository productRepository;
    private final ProductBatchRepository batchRepository;
    private final ProductSerialRepository serialRepository;
    private final EmailTemplateService emailTemplateService;

    // Run daily at 9 AM
    @Scheduled(cron = "0 0 9 * * *")
    public void checkLowStockProducts() {
        log.info("Checking for low stock products...");
        
        List<Product> lowStockProducts = productRepository.findLowStockProducts();
        
        for (Product product : lowStockProducts) {
            if (product.getStockQuantity() <= product.getReorderLevel()) {
                emailTemplateService.sendLowStockAlert(
                    product.getName(),
                    product.getSku(),
                    product.getStockQuantity(),
                    product.getReorderLevel()
                );
            }
        }
        
        log.info("Low stock check completed. Found {} products", lowStockProducts.size());
    }

    // Run daily at 9 AM
    @Scheduled(cron = "0 0 9 * * *")
    public void checkExpiringBatches() {
        log.info("Checking for expiring batches...");
        
        LocalDate thirtyDaysFromNow = LocalDate.now().plusDays(30);
        List<ProductBatch> expiringBatches = batchRepository.findExpiringBatches(thirtyDaysFromNow);
        
        for (ProductBatch batch : expiringBatches) {
            if (batch.getExpiryDate() != null) {
                long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), batch.getExpiryDate());
                
                if (daysRemaining <= 30 && daysRemaining >= 0) {
                    emailTemplateService.sendBatchExpiryAlert(
                        batch.getBatchNumber(),
                        batch.getProduct().getName(),
                        batch.getExpiryDate(),
                        (int) daysRemaining
                    );
                }
            }
        }
        
        log.info("Batch expiry check completed. Found {} expiring batches", expiringBatches.size());
    }

    // Run daily at 9 AM
    @Scheduled(cron = "0 0 9 * * *")
    public void checkExpiringWarranties() {
        log.info("Checking for expiring warranties...");
        
        LocalDate thirtyDaysFromNow = LocalDate.now().plusDays(30);
        List<ProductSerial> expiringWarranties = serialRepository.findWarrantyExpiring(thirtyDaysFromNow);
        
        for (ProductSerial serial : expiringWarranties) {
            if (serial.getWarrantyExpiryDate() != null) {
                long daysRemaining = ChronoUnit.DAYS.between(LocalDate.now(), serial.getWarrantyExpiryDate());
                
                if (daysRemaining <= 30 && daysRemaining >= 0) {
                    String customerName = "Unknown Customer"; // Would fetch from customer repository
                    
                    emailTemplateService.sendWarrantyExpiryAlert(
                        serial.getSerialNumber(),
                        serial.getProduct().getName(),
                        customerName,
                        serial.getWarrantyExpiryDate(),
                        (int) daysRemaining
                    );
                }
            }
        }
        
        log.info("Warranty expiry check completed. Found {} expiring warranties", expiringWarranties.size());
    }
}
