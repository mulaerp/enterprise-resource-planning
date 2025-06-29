package com.mulaerp.controller;

import com.mulaerp.dto.CasLoginRequest;
import com.mulaerp.dto.CasPreloginRequest;
import com.mulaerp.dto.CasPreloginResponse;
import com.mulaerp.dto.LoginRequest;
import com.mulaerp.dto.LoginResponse;
import com.mulaerp.service.AuthService;
import com.mulaerp.service.CasService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Value("${cas.base.url:https://app.penril.net/pineapple-backend}")
    private String defaultCasBaseUrl;

    private final AuthService authService;
    private final CasService casService;

    public AuthController(AuthService authService, CasService casService) {
        this.authService = authService;
        this.casService = casService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        try {
            // Demo credentials bypass
            if ("demo@demo.net".equals(request.getEmail()) && "demo".equals(request.getPassword())) {
                LoginResponse response = authService.createDemoToken(request.getEmail());
                return ResponseEntity.ok(response);
            }

            // Try CAS authentication with default URL
            casService.setCasBaseUrl(defaultCasBaseUrl);
            LoginResponse response = authService.authenticateWithCAS(request.getEmail(), request.getPassword());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new LoginResponse(null, null, "Authentication failed: " + e.getMessage()));
        }
    }

    @PostMapping("/cas/login")
    public ResponseEntity<LoginResponse> casLogin(@RequestBody CasLoginRequest request) {
        try {
            // Use default CAS base URL (configured server-side)
            casService.setCasBaseUrl(defaultCasBaseUrl);
            
            LoginResponse response = authService.authenticateWithCAS(
                request.getUsername(), 
                request.getPassword(), 
                request.getImageId()
            );
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new LoginResponse(null, null, "CAS authentication failed: " + e.getMessage()));
        }
    }

    @PostMapping("/cas/prelogin")
    public ResponseEntity<CasPreloginResponse> getPreloginData(@RequestBody CasPreloginRequest request) {
        try {
            // Use default CAS base URL (configured server-side)
            casService.setCasBaseUrl(defaultCasBaseUrl);
            
            CasPreloginResponse response = casService.getPreloginData(request.getUsername()).get();
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new CasPreloginResponse());
        }
    }

    @PostMapping("/cas/verify-image")
    public ResponseEntity<Map<String, Boolean>> verifySecurityImage(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String imageId = request.get("imageId");
            
            // Use default CAS base URL (configured server-side)
            casService.setCasBaseUrl(defaultCasBaseUrl);
            
            boolean isValid = casService.verifySecurityImage(username, imageId).get();
            return ResponseEntity.ok(Map.of("valid", isValid));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("valid", false));
        }
    }

    @PostMapping("/validate")
    public ResponseEntity<Boolean> validateToken(@RequestHeader("Authorization") String token) {
        try {
            String jwt = token.replace("Bearer ", "");
            boolean isValid = authService.validateToken(jwt);
            return ResponseEntity.ok(isValid);
        } catch (Exception e) {
            return ResponseEntity.ok(false);
        }
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refreshToken(@RequestHeader("Authorization") String token) {
        try {
            String jwt = token.replace("Bearer ", "");
            LoginResponse response = authService.refreshToken(jwt);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new LoginResponse(null, null, "Token refresh failed"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout(@RequestHeader("Authorization") String token) {
        try {
            String jwt = token.replace("Bearer ", "");
            authService.logout(jwt);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false));
        }
    }

    @PostMapping("/cas/change-password")
    public ResponseEntity<Map<String, Boolean>> changePassword(
            @RequestBody Map<String, String> request,
            @RequestHeader("Authorization") String token) {
        try {
            String username = request.get("username");
            String oldPassword = request.get("oldPassword");
            String newPassword = request.get("newPassword");
            String keyId = request.get("keyId");

            casService.setCasBaseUrl(defaultCasBaseUrl);

            boolean success = casService.changePassword(username, oldPassword, newPassword, keyId).get();
            return ResponseEntity.ok(Map.of("success", success));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false));
        }
    }

    @PostMapping("/cas/reset-password")
    public ResponseEntity<Map<String, Boolean>> resetPassword(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String email = request.get("email");

            casService.setCasBaseUrl(defaultCasBaseUrl);

            boolean success = casService.resetPassword(username, email).get();
            return ResponseEntity.ok(Map.of("success", success));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false));
        }
    }
}