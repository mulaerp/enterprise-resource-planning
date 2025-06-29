package com.mulaerp.service;

import com.mulaerp.dto.CasPasswordVerifyResponse;
import com.mulaerp.dto.LoginResponse;
import com.mulaerp.dto.UserInfo;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {

    @Value("${jwt.secret:your-super-secret-jwt-key-change-in-production-min-32-chars}")
    private String jwtSecret;

    private final CasService casService;
    private final Map<String, String> activeCasTokens = new ConcurrentHashMap<>();

    public AuthService(CasService casService) {
        this.casService = casService;
    }

    public LoginResponse authenticateWithCAS(String username, String password) {
        return authenticateWithCAS(username, password, null);
    }

    public LoginResponse authenticateWithCAS(String username, String password, String imageId) {
        try {
            CasPasswordVerifyResponse casResponse = casService.authenticateUser(username, password, imageId).get();
            
            if (casResponse.isSuccess() && casResponse.getJwt() != null) {
                // Store CAS JWT for periodic updates
                String localToken = generateToken(casResponse.getUserInfo());
                activeCasTokens.put(localToken, casResponse.getJwt());
                
                return new LoginResponse(localToken, casResponse.getUserInfo(), null);
            } else {
                return new LoginResponse(null, null, casResponse.getMessage() != null ? 
                    casResponse.getMessage() : "CAS authentication failed");
            }
        } catch (Exception e) {
            return new LoginResponse(null, null, "CAS authentication error: " + e.getMessage());
        }
    }

    public LoginResponse createDemoToken(String email) {
        UserInfo userInfo = new UserInfo("demo", "Demo User", email, "Administrator");
        String token = generateToken(userInfo);
        return new LoginResponse(token, userInfo, null);
    }

    public String generateToken(UserInfo userInfo) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userInfo.getId());
        claims.put("name", userInfo.getName());
        claims.put("email", userInfo.getEmail());
        claims.put("role", userInfo.getRole());

        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());

        return Jwts.builder()
                .claims(claims)
                .subject(userInfo.getEmail())
                .issuedAt(new Date())
                .expiration(Date.from(Instant.now().plus(24, ChronoUnit.HOURS)))
                .signWith(key)
                .compact();
    }

    public boolean validateToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            
            // Also verify with CAS if it's a CAS token
            String casToken = activeCasTokens.get(token);
            if (casToken != null) {
                return casService.verifyJwt(casToken).join();
            }
            
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public Claims getClaimsFromToken(String token) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public LoginResponse refreshToken(String token) {
        try {
            Claims claims = getClaimsFromToken(token);
            UserInfo userInfo = new UserInfo(
                claims.get("userId", String.class),
                claims.get("name", String.class),
                claims.get("email", String.class),
                claims.get("role", String.class)
            );
            
            // Update CAS token if applicable
            String casToken = activeCasTokens.get(token);
            if (casToken != null) {
                try {
                    String updatedCasToken = casService.updateJwt(casToken).get();
                    activeCasTokens.remove(token);
                    String newToken = generateToken(userInfo);
                    activeCasTokens.put(newToken, updatedCasToken);
                    return new LoginResponse(newToken, userInfo, null);
                } catch (Exception e) {
                    // If CAS token update fails, remove from active tokens
                    activeCasTokens.remove(token);
                }
            }
            
            String newToken = generateToken(userInfo);
            return new LoginResponse(newToken, userInfo, null);
        } catch (Exception e) {
            throw new RuntimeException("Token refresh failed");
        }
    }

    public void logout(String token) {
        activeCasTokens.remove(token);
    }

    /**
     * Scheduled task to update CAS tokens every 10 minutes
     */
    @Scheduled(fixedRate = 600000) // 10 minutes
    public void updateCasTokens() {
        activeCasTokens.entrySet().removeIf(entry -> {
            try {
                String updatedToken = casService.updateJwt(entry.getValue()).get();
                entry.setValue(updatedToken);
                return false; // Keep the entry
            } catch (Exception e) {
                // Remove invalid tokens
                return true;
            }
        });
    }
}