package com.mulaerp.notifications.controller;

import com.mulaerp.notifications.dto.NotificationDTO;
import com.mulaerp.notifications.service.NotificationService;
import com.mulaerp.util.PageSizeCap;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<Page<NotificationDTO>> getNotifications(
        @RequestParam(defaultValue = "dev-user") String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
            notificationService.getUserNotifications(userId, PageRequest.of(page, PageSizeCap.cap(size)))
        );
    }

    @GetMapping("/unread")
    public ResponseEntity<Page<NotificationDTO>> getUnreadNotifications(
        @RequestParam(defaultValue = "dev-user") String userId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
            notificationService.getUnreadNotifications(userId, PageRequest.of(page, PageSizeCap.cap(size)))
        );
    }

    @GetMapping("/unread/count")
    public ResponseEntity<Long> getUnreadCount(
        @RequestParam(defaultValue = "dev-user") String userId
    ) {
        return ResponseEntity.ok(notificationService.getUnreadCount(userId));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable String id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(
        @RequestParam(defaultValue = "dev-user") String userId
    ) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
}
