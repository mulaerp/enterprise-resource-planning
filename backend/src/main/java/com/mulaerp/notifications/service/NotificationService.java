package com.mulaerp.notifications.service;

import com.mulaerp.notifications.dto.NotificationDTO;
import com.mulaerp.notifications.entity.Notification;
import com.mulaerp.notifications.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public Page<NotificationDTO> getUserNotifications(String userId, Pageable pageable) {
        return notificationRepository.findByUserId(userId, pageable)
            .map(this::toDTO);
    }

    public Page<NotificationDTO> getUnreadNotifications(String userId, Pageable pageable) {
        return notificationRepository.findUnreadByUserId(userId, pageable)
            .map(this::toDTO);
    }

    public Long getUnreadCount(String userId) {
        return notificationRepository.countUnreadByUserId(userId);
    }

    @Transactional
    public void markAsRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
            notificationRepository.save(notification);
        });
    }

    @Transactional
    public void markAllAsRead(String userId) {
        Page<Notification> unread = notificationRepository.findUnreadByUserId(
            userId, 
            Pageable.unpaged()
        );
        
        unread.forEach(notification -> {
            notification.setIsRead(true);
            notification.setReadAt(LocalDateTime.now());
        });
        
        notificationRepository.saveAll(unread.getContent());
    }

    @Transactional
    public void createNotification(String userId, String type, String title, String message, 
                                   String referenceType, String referenceId, String priority) {
        Notification notification = Notification.builder()
            .userId(userId)
            .type(type)
            .title(title)
            .message(message)
            .referenceType(referenceType)
            .referenceId(referenceId)
            .priority(priority != null ? priority : "NORMAL")
            .isRead(false)
            .build();
        
        notificationRepository.save(notification);
    }

    public void createLowStockAlert(String userId, String productId, String productName, int stockQuantity) {
        createNotification(
            userId,
            "LOW_STOCK",
            "Low Stock Alert",
            String.format("Product '%s' is running low on stock. Current quantity: %d", productName, stockQuantity),
            "PRODUCT",
            productId,
            "HIGH"
        );
    }

    public void createOrderStatusNotification(String userId, String orderId, String orderNumber, String newStatus) {
        createNotification(
            userId,
            "ORDER_STATUS",
            "Order Status Updated",
            String.format("Order %s status changed to %s", orderNumber, newStatus),
            "ORDER",
            orderId,
            "NORMAL"
        );
    }

    private NotificationDTO toDTO(Notification notification) {
        return NotificationDTO.builder()
            .id(notification.getId().toString())
            .type(notification.getType())
            .title(notification.getTitle())
            .message(notification.getMessage())
            .referenceType(notification.getReferenceType())
            .referenceId(notification.getReferenceId())
            .isRead(notification.getIsRead())
            .readAt(notification.getReadAt())
            .priority(notification.getPriority())
            .createdAt(notification.getCreatedAt())
            .build();
    }
}
