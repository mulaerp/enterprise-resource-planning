package com.mulaerp.service;

import com.mulaerp.entity.Employee;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;

@Service
public class CasUserService {

    @Value("${cas.base.url:https://app.penril.net/pineapple-backend}")
    private String casBaseUrl;

    private final WebClient webClient;

    public CasUserService() {
        this.webClient = WebClient.builder()
                .codecs(configurer -> configurer.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
                .build();
    }

    public void createUser(Employee employee) throws Exception {
        Map<String, Object> userRequest = new HashMap<>();
        userRequest.put("username", employee.getEmail());
        userRequest.put("email", employee.getEmail());
        userRequest.put("fullName", employee.getName());
        userRequest.put("department", employee.getDepartment());
        userRequest.put("position", employee.getPosition());
        userRequest.put("phone", employee.getPhone());
        userRequest.put("status", "active");
        userRequest.put("role", "employee");
        
        // Generate temporary password
        userRequest.put("temporaryPassword", generateTemporaryPassword());
        userRequest.put("requirePasswordChange", true);

        try {
            String response = webClient.post()
                    .uri(casBaseUrl + "/v1/useradmin/adduser")
                    .header("Content-Type", "application/json")
                    .header("X-Admin-Token", getAdminToken())
                    .bodyValue(userRequest)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            System.out.println("CAS user created successfully for employee: " + employee.getName());
        } catch (Exception e) {
            System.err.println("Failed to create CAS user: " + e.getMessage());
            throw e;
        }
    }

    public void updateUser(Employee employee) throws Exception {
        Map<String, Object> updateRequest = new HashMap<>();
        updateRequest.put("username", employee.getEmail());
        updateRequest.put("email", employee.getEmail());
        updateRequest.put("fullName", employee.getName());
        updateRequest.put("department", employee.getDepartment());
        updateRequest.put("position", employee.getPosition());
        updateRequest.put("phone", employee.getPhone());
        updateRequest.put("status", employee.getStatus());

        try {
            String response = webClient.put()
                    .uri(casBaseUrl + "/v1/useradmin/updateuser")
                    .header("Content-Type", "application/json")
                    .header("X-Admin-Token", getAdminToken())
                    .bodyValue(updateRequest)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            System.out.println("CAS user updated successfully for employee: " + employee.getName());
        } catch (Exception e) {
            System.err.println("Failed to update CAS user: " + e.getMessage());
            throw e;
        }
    }

    public void deactivateUser(String employeeId) throws Exception {
        Map<String, Object> deactivateRequest = new HashMap<>();
        deactivateRequest.put("employeeId", employeeId);
        deactivateRequest.put("status", "inactive");

        try {
            String response = webClient.post()
                    .uri(casBaseUrl + "/v1/useradmin/deactivateuser")
                    .header("Content-Type", "application/json")
                    .header("X-Admin-Token", getAdminToken())
                    .bodyValue(deactivateRequest)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            System.out.println("CAS user deactivated successfully for employee ID: " + employeeId);
        } catch (Exception e) {
            System.err.println("Failed to deactivate CAS user: " + e.getMessage());
            throw e;
        }
    }

    public void resetPassword(String username) throws Exception {
        Map<String, Object> resetRequest = new HashMap<>();
        resetRequest.put("username", username);
        resetRequest.put("sendEmail", true);

        try {
            String response = webClient.post()
                    .uri(casBaseUrl + "/v1/useradmin/resetpassword")
                    .header("Content-Type", "application/json")
                    .header("X-Admin-Token", getAdminToken())
                    .bodyValue(resetRequest)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            System.out.println("Password reset initiated for user: " + username);
        } catch (Exception e) {
            System.err.println("Failed to reset password: " + e.getMessage());
            throw e;
        }
    }

    private String getAdminToken() {
        // In production, this should be retrieved from secure configuration
        return System.getenv("CAS_ADMIN_TOKEN");
    }

    private String generateTemporaryPassword() {
        // Generate a secure temporary password
        return "Temp" + System.currentTimeMillis() + "!";
    }
}