package com.mulaerp.controller;

import com.mulaerp.service.ConfigService;
import com.mulaerp.service.LhdnService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/config")
@CrossOrigin(origins = "*")
public class ConfigController {

    private final ConfigService configService;
    private final LhdnService lhdnService;

    public ConfigController(ConfigService configService, LhdnService lhdnService) {
        this.configService = configService;
        this.lhdnService = lhdnService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getAllConfigs() {
        try {
            Map<String, Object> configs = configService.getAllConfigs();
            return ResponseEntity.ok(configs);
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("error", "Failed to load configuration: " + e.getMessage()));
        }
    }

    @GetMapping("/{key}")
    public ResponseEntity<Map<String, Object>> getConfig(@PathVariable String key) {
        try {
            Object value = configService.getConfig(key);
            return ResponseEntity.ok(Map.of("value", value));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("value", null, "error", e.getMessage()));
        }
    }

    @PutMapping("/{key}")
    public ResponseEntity<Map<String, Object>> setConfig(@PathVariable String key, @RequestBody Map<String, Object> request) {
        try {
            Object value = request.get("value");
            configService.setConfig(key, value);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/validate")
    public ResponseEntity<Map<String, Object>> validateConfig() {
        try {
            boolean isValid = configService.validateConfig();
            return ResponseEntity.ok(Map.of("valid", isValid));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("valid", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/lhdn/test")
    public ResponseEntity<Map<String, Object>> testLhdnConnection() {
        try {
            Object lhdnEnabledObj = configService.getConfig("lhdnMyInvoisEnabled");
            boolean isEnabled = lhdnEnabledObj instanceof Boolean ? (Boolean) lhdnEnabledObj : false;
            
            if (!isEnabled) {
                return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "LHDN MyInvois integration is disabled"
                ));
            }

            String gatewayUrl = (String) configService.getConfig("lhdnGatewayUrl");
            String clientId = (String) configService.getConfig("lhdnClientId");
            String clientSecret = (String) configService.getConfig("lhdnClientSecret");

            if (gatewayUrl == null || gatewayUrl.isEmpty() || 
                clientId == null || clientId.isEmpty() || 
                clientSecret == null || clientSecret.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "LHDN configuration is incomplete"
                ));
            }

            // Test connection to gateway
            boolean connectionSuccess = lhdnService.testConnection(gatewayUrl, clientId, clientSecret);
            
            return ResponseEntity.ok(Map.of(
                "success", connectionSuccess,
                "message", connectionSuccess ? "Connection successful" : "Connection failed"
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                "success", false,
                "message", "Connection test failed: " + e.getMessage()
            ));
        }
    }
}