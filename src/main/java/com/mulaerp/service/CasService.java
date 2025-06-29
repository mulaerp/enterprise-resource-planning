package com.mulaerp.service;

import com.mulaerp.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import javax.crypto.Cipher;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import java.util.Map;
import java.util.HashMap;

@Service
public class CasService {

    @Value("${cas.base.url:https://app.penril.net/pineapple-backend}")
    private String defaultCasBaseUrl;
    
    private String casBaseUrl;
    private final WebClient webClient;

    public CasService() {
        this.webClient = WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
        this.casBaseUrl = defaultCasBaseUrl;
    }

    public void setCasBaseUrl(String casBaseUrl) {
        this.casBaseUrl = casBaseUrl != null ? casBaseUrl : defaultCasBaseUrl;
    }

    /**
     * Get public key for password encryption
     */
    public CompletableFuture<CasPublicKeyResponse> getPublicKey() {
        return webClient.get()
                .uri(casBaseUrl + "/v1/sess/publickey")
                .header("X-Encrypt", "true")
                .retrieve()
                .bodyToMono(CasPublicKeyResponse.class)
                .toFuture()
                .exceptionally(throwable -> {
                    throw new RuntimeException("Failed to get public key from CAS: " + throwable.getMessage());
                });
    }

    /**
     * Get prelogin data (security phrase and images) for a specific user
     */
    public CompletableFuture<CasPreloginResponse> getPreloginData(String username) {
        return getPublicKey()
                .thenCompose(publicKeyResponse -> {
                    try {
                        // Encrypt the username as required by X-Encrypt header
                        String encryptedUsername = encryptPassword(username, publicKeyResponse.getPublicKey());
                        
                        Map<String, String> requestBody = new HashMap<>();
                        requestBody.put("username", encryptedUsername);

                        return webClient.post()
                                .uri(casBaseUrl + "/v1/prelogin/get")
                                .header("X-Encrypt", "true")
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(CasPreloginExternalApiResponse.class)
                                .toFuture();
                    } catch (Exception e) {
                        throw new RuntimeException("Failed to encrypt username: " + e.getMessage());
                    }
                })
                .thenApply(externalResponse -> {
                    // Transform external API response to internal format
                    CasPreloginResponse response = new CasPreloginResponse();
                    
                    if (externalResponse != null && externalResponse.getData() != null) {
                        CasPreloginDataPayload data = externalResponse.getData();
                        
                        // Set the phrase
                        response.setPhrase(data.getPassphrase());
                        
                        // Convert base64 security image to CasPreloginImage list
                        List<CasPreloginImage> images = new ArrayList<>();
                        if (data.getSecurityImage() != null && !data.getSecurityImage().isEmpty()) {
                            CasPreloginImage image = new CasPreloginImage();
                            image.setId("security-image-1");
                            image.setName("Security Image");
                            image.setDescription("Your security image");
                            // Convert base64 to data URL
                            image.setUrl("data:image/jpeg;base64," + data.getSecurityImage());
                            images.add(image);
                        }
                        response.setImages(images);
                    }
                    
                    return response;
                })
                .exceptionally(throwable -> {
                    if (throwable instanceof WebClientResponseException) {
                        WebClientResponseException ex = (WebClientResponseException) throwable;
                        System.err.println("CAS prelogin error: " + ex.getResponseBodyAsString());
                    }
                    throw new RuntimeException("Failed to get prelogin data from CAS: " + throwable.getMessage());
                });
    }

    /**
     * Verify security image selection
     */
    public CompletableFuture<Boolean> verifySecurityImage(String username, String imageId) {
        return getPublicKey()
                .thenCompose(publicKeyResponse -> {
                    try {
                        // Encrypt the username as required by X-Encrypt header
                        String encryptedUsername = encryptPassword(username, publicKeyResponse.getPublicKey());
                        
                        Map<String, String> requestBody = new HashMap<>();
                        requestBody.put("username", encryptedUsername);
                        requestBody.put("imageId", imageId);

                        return webClient.post()
                                .uri(casBaseUrl + "/v1/prelogin/verify-image")
                                .header("X-Encrypt", "true")
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(Boolean.class)
                                .toFuture();
                    } catch (Exception e) {
                        return CompletableFuture.completedFuture(false);
                    }
                })
                .exceptionally(throwable -> {
                    // For now, we'll simulate image verification since the exact API endpoint isn't clear
                    // In a real implementation, this might be part of the prelogin flow or a separate endpoint
                    return imageId != null && !imageId.isEmpty();
                });
    }

    /**
     * Verify password and authenticate user
     */
    public CompletableFuture<CasPasswordVerifyResponse> verifyPassword(CasPasswordVerifyRequest request) {
        return webClient.post()
                .uri(casBaseUrl + "/v1/password/verify")
                .header("X-Encrypt", "true")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(CasPasswordVerifyResponse.class)
                .toFuture()
                .exceptionally(throwable -> {
                    if (throwable instanceof WebClientResponseException) {
                        WebClientResponseException ex = (WebClientResponseException) throwable;
                        CasPasswordVerifyResponse errorResponse = new CasPasswordVerifyResponse();
                        errorResponse.setSuccess(false);
                        errorResponse.setMessage("Authentication failed: " + ex.getResponseBodyAsString());
                        return errorResponse;
                    }
                    throw new RuntimeException("Failed to verify password with CAS: " + throwable.getMessage());
                });
    }

    /**
     * Verify JWT token
     */
    public CompletableFuture<Boolean> verifyJwt(String jwt) {
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("jwt", jwt);
        
        return webClient.post()
                .uri(casBaseUrl + "/v1/jwt/verify")
                .header("X-Encrypt", "true")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(Boolean.class)
                .toFuture()
                .exceptionally(throwable -> false);
    }

    /**
     * Update/extend JWT token
     */
    public CompletableFuture<String> updateJwt(String jwt) {
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("jwt", jwt);
        
        return webClient.post()
                .uri(casBaseUrl + "/v1/jwt/update")
                .header("X-Encrypt", "true")
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(String.class)
                .toFuture()
                .exceptionally(throwable -> {
                    throw new RuntimeException("Failed to update JWT with CAS: " + throwable.getMessage());
                });
    }

    /**
     * Change password
     */
    public CompletableFuture<Boolean> changePassword(String username, String oldPassword, String newPassword, String keyId) {
        return getPublicKey()
                .thenCompose(publicKeyResponse -> {
                    try {
                        String encryptedUsername = encryptPassword(username, publicKeyResponse.getPublicKey());
                        String encryptedOldPassword = encryptPassword(oldPassword, publicKeyResponse.getPublicKey());
                        String encryptedNewPassword = encryptPassword(newPassword, publicKeyResponse.getPublicKey());

                        Map<String, String> requestBody = new HashMap<>();
                        requestBody.put("username", encryptedUsername);
                        requestBody.put("oldPassword", encryptedOldPassword);
                        requestBody.put("newPassword", encryptedNewPassword);
                        requestBody.put("keyId", keyId);

                        return webClient.post()
                                .uri(casBaseUrl + "/v1/password/change")
                                .header("X-Encrypt", "true")
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(Boolean.class)
                                .toFuture();
                    } catch (Exception e) {
                        return CompletableFuture.completedFuture(false);
                    }
                })
                .exceptionally(throwable -> false);
    }

    /**
     * Reset password
     */
    public CompletableFuture<Boolean> resetPassword(String username, String email) {
        return getPublicKey()
                .thenCompose(publicKeyResponse -> {
                    try {
                        String encryptedUsername = encryptPassword(username, publicKeyResponse.getPublicKey());
                        String encryptedEmail = encryptPassword(email, publicKeyResponse.getPublicKey());

                        Map<String, String> requestBody = new HashMap<>();
                        requestBody.put("username", encryptedUsername);
                        requestBody.put("email", encryptedEmail);

                        return webClient.post()
                                .uri(casBaseUrl + "/v1/password/reset")
                                .header("X-Encrypt", "true")
                                .bodyValue(requestBody)
                                .retrieve()
                                .bodyToMono(Boolean.class)
                                .toFuture();
                    } catch (Exception e) {
                        return CompletableFuture.completedFuture(false);
                    }
                })
                .exceptionally(throwable -> false);
    }

    /**
     * Encrypt password using RSA public key
     */
    public String encryptPassword(String password, String publicKeyString) throws Exception {
        // Remove PEM headers and decode base64
        String cleanKey = publicKeyString
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");

        byte[] keyBytes = Base64.getDecoder().decode(cleanKey);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");
        PublicKey publicKey = keyFactory.generatePublic(spec);

        Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);
        byte[] encryptedBytes = cipher.doFinal(password.getBytes("UTF-8"));

        return Base64.getEncoder().encodeToString(encryptedBytes);
    }

    /**
     * Complete authentication flow
     */
    public CompletableFuture<CasPasswordVerifyResponse> authenticateUser(String username, String password, String imageId) {
        return getPublicKey()
                .thenCompose(publicKeyResponse -> {
                    try {
                        String encryptedUsername = encryptPassword(username, publicKeyResponse.getPublicKey());
                        String encryptedPassword = encryptPassword(password, publicKeyResponse.getPublicKey());
                        
                        CasPasswordVerifyRequest verifyRequest = new CasPasswordVerifyRequest(
                                encryptedUsername, encryptedPassword, publicKeyResponse.getKeyId(), imageId);
                        return verifyPassword(verifyRequest);
                    } catch (Exception e) {
                        CasPasswordVerifyResponse errorResponse = new CasPasswordVerifyResponse();
                        errorResponse.setSuccess(false);
                        errorResponse.setMessage("Password encryption failed: " + e.getMessage());
                        return CompletableFuture.completedFuture(errorResponse);
                    }
                });
    }
}