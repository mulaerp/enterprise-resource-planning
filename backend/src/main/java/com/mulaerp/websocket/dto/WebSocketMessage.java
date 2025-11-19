package com.mulaerp.websocket.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessage {
    private String type;
    private String message;
    private Object data;
    private LocalDateTime timestamp;

    public WebSocketMessage(String type, String message, Object data) {
        this.type = type;
        this.message = message;
        this.data = data;
        this.timestamp = LocalDateTime.now();
    }

    public static WebSocketMessage notification(String message, Object data) {
        return new WebSocketMessage("NOTIFICATION", message, data);
    }

    public static WebSocketMessage update(String message, Object data) {
        return new WebSocketMessage("UPDATE", message, data);
    }

    public static WebSocketMessage alert(String message, Object data) {
        return new WebSocketMessage("ALERT", message, data);
    }
}
