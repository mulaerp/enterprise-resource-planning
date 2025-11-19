package com.mulaerp.websocket.service;

import com.mulaerp.websocket.dto.WebSocketMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Send message to all connected clients
     */
    public void sendToAll(WebSocketMessage message) {
        log.debug("Broadcasting message to all clients: {}", message.getType());
        messagingTemplate.convertAndSend("/topic/updates", message);
    }

    /**
     * Send message to specific user
     */
    public void sendToUser(String username, WebSocketMessage message) {
        log.debug("Sending message to user {}: {}", username, message.getType());
        messagingTemplate.convertAndSendToUser(username, "/queue/messages", message);
    }

    /**
     * Send notification to all clients
     */
    public void broadcastNotification(String message, Object data) {
        sendToAll(WebSocketMessage.notification(message, data));
    }

    /**
     * Send update notification to all clients
     */
    public void broadcastUpdate(String message, Object data) {
        sendToAll(WebSocketMessage.update(message, data));
    }

    /**
     * Send alert to all clients
     */
    public void broadcastAlert(String message, Object data) {
        sendToAll(WebSocketMessage.alert(message, data));
    }

    /**
     * Notify about new order
     */
    public void notifyNewOrder(Object orderData) {
        broadcastNotification("New order created", orderData);
    }

    /**
     * Notify about order status change
     */
    public void notifyOrderStatusChange(Object orderData) {
        broadcastUpdate("Order status updated", orderData);
    }

    /**
     * Notify about low stock
     */
    public void notifyLowStock(Object productData) {
        broadcastAlert("Low stock alert", productData);
    }

    /**
     * Notify about new invoice
     */
    public void notifyNewInvoice(Object invoiceData) {
        broadcastNotification("New invoice created", invoiceData);
    }

    /**
     * Notify about payment received
     */
    public void notifyPaymentReceived(Object paymentData) {
        broadcastNotification("Payment received", paymentData);
    }
}
