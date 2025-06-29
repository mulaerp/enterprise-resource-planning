package com.mulaerp.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Map;

@Service
public class LhdnService {

    private final WebClient webClient;

    public LhdnService() {
        this.webClient = WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    /**
     * Test connection to LHDN MyInvois Gateway
     */
    public boolean testConnection(String gatewayUrl, String clientId, String clientSecret) {
        try {
            String response = webClient.get()
                    .uri(gatewayUrl + "/api/test")
                    .header("X-Client-ID", clientId)
                    .header("X-Client-Secret", clientSecret)
                    .retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(10))
                    .block();

            return response != null && !response.isEmpty();
        } catch (WebClientResponseException e) {
            System.err.println("LHDN Gateway connection test failed: " + e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            System.err.println("LHDN Gateway connection test error: " + e.getMessage());
            return false;
        }
    }

    /**
     * Submit invoice to LHDN MyInvois Gateway
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> submitInvoice(String gatewayUrl, String clientId, String clientSecret, Map<String, Object> invoiceData) {
        try {
            Map<String, Object> response = webClient.post()
                    .uri(gatewayUrl + "/api/invoices/submit")
                    .header("X-Client-ID", clientId)
                    .header("X-Client-Secret", clientSecret)
                    .header("Content-Type", "application/json")
                    .bodyValue(invoiceData)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();

            return response != null ? response : Map.of("success", false, "message", "No response from gateway");
        } catch (WebClientResponseException e) {
            System.err.println("LHDN invoice submission failed: " + e.getResponseBodyAsString());
            return Map.of("success", false, "message", "Gateway error: " + e.getStatusCode());
        } catch (Exception e) {
            System.err.println("LHDN invoice submission error: " + e.getMessage());
            return Map.of("success", false, "message", "Submission failed: " + e.getMessage());
        }
    }

    /**
     * Get invoice status from LHDN MyInvois Gateway
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getInvoiceStatus(String gatewayUrl, String clientId, String clientSecret, String invoiceUuid) {
        try {
            Map<String, Object> response = webClient.get()
                    .uri(gatewayUrl + "/api/invoices/" + invoiceUuid + "/status")
                    .header("X-Client-ID", clientId)
                    .header("X-Client-Secret", clientSecret)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();

            return response != null ? response : Map.of("success", false, "message", "No response from gateway");
        } catch (WebClientResponseException e) {
            System.err.println("LHDN status check failed: " + e.getResponseBodyAsString());
            return Map.of("success", false, "message", "Gateway error: " + e.getStatusCode());
        } catch (Exception e) {
            System.err.println("LHDN status check error: " + e.getMessage());
            return Map.of("success", false, "message", "Status check failed: " + e.getMessage());
        }
    }

    /**
     * Cancel invoice in LHDN MyInvois Gateway
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> cancelInvoice(String gatewayUrl, String clientId, String clientSecret, String invoiceUuid, String reason) {
        try {
            Map<String, Object> requestBody = Map.of("reason", reason);
            
            Map<String, Object> response = webClient.post()
                    .uri(gatewayUrl + "/api/invoices/" + invoiceUuid + "/cancel")
                    .header("X-Client-ID", clientId)
                    .header("X-Client-Secret", clientSecret)
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(15))
                    .block();

            return response != null ? response : Map.of("success", false, "message", "No response from gateway");
        } catch (WebClientResponseException e) {
            System.err.println("LHDN invoice cancellation failed: " + e.getResponseBodyAsString());
            return Map.of("success", false, "message", "Gateway error: " + e.getStatusCode());
        } catch (Exception e) {
            System.err.println("LHDN invoice cancellation error: " + e.getMessage());
            return Map.of("success", false, "message", "Cancellation failed: " + e.getMessage());
        }
    }

    /**
     * Validate invoice with LHDN MyInvois Gateway
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> validateInvoice(String gatewayUrl, String clientId, String clientSecret, Map<String, Object> invoiceData) {
        try {
            Map<String, Object> response = webClient.post()
                    .uri(gatewayUrl + "/api/invoices/validate")
                    .header("X-Client-ID", clientId)
                    .header("X-Client-Secret", clientSecret)
                    .header("Content-Type", "application/json")
                    .bodyValue(invoiceData)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(20))
                    .block();

            return response != null ? response : Map.of("success", false, "message", "No response from gateway");
        } catch (WebClientResponseException e) {
            System.err.println("LHDN invoice validation failed: " + e.getResponseBodyAsString());
            return Map.of("success", false, "message", "Gateway error: " + e.getStatusCode());
        } catch (Exception e) {
            System.err.println("LHDN invoice validation error: " + e.getMessage());
            return Map.of("success", false, "message", "Validation failed: " + e.getMessage());
        }
    }
}