package com.mulaerp.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class ConfigService {

    @Value("${encryption.key:your-32-char-encryption-key-here}")
    private String encryptionKey;

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;
    
    private final Map<String, Object> defaultConfigs;
    private final Map<String, Object> inMemoryCache = new HashMap<>();
    private boolean redisAvailable = false;

    public ConfigService() {
        this.defaultConfigs = initializeDefaultConfigs();
    }

    private void checkRedisAvailability() {
        if (redisTemplate != null && !redisAvailable) {
            try {
                redisTemplate.opsForValue().set("test-connection", "test", 1, TimeUnit.SECONDS);
                redisAvailable = true;
                System.out.println("Redis connection verified successfully");
            } catch (Exception e) {
                redisAvailable = false;
                System.err.println("Redis not available, using in-memory cache: " + e.getMessage());
            }
        }
    }

    public Map<String, Object> getAllConfigs() {
        checkRedisAvailability();
        Map<String, Object> configs = new HashMap<>();
        
        // Get all config keys from cache/defaults
        for (String key : defaultConfigs.keySet()) {
            configs.put(key, getConfig(key));
        }
        
        return configs;
    }

    public Object getConfig(String key) {
        checkRedisAvailability();
        
        try {
            // Try to get from Redis cache first if available
            if (redisAvailable && redisTemplate != null) {
                String cachedValue = (String) redisTemplate.opsForValue().get("config:" + key);
                if (cachedValue != null) {
                    return decrypt(cachedValue);
                }
            } else {
                // Use in-memory cache if Redis is not available
                Object cachedValue = inMemoryCache.get("config:" + key);
                if (cachedValue != null) {
                    return cachedValue;
                }
            }
            
            // Return default value
            return defaultConfigs.get(key);
        } catch (Exception e) {
            System.err.println("Error getting config " + key + ": " + e.getMessage());
            // Fallback to in-memory cache
            Object cachedValue = inMemoryCache.get("config:" + key);
            if (cachedValue != null) {
                return cachedValue;
            }
            return defaultConfigs.get(key);
        }
    }

    public void setConfig(String key, Object value) {
        checkRedisAvailability();
        
        try {
            if (redisAvailable && redisTemplate != null) {
                // Use Redis if available
                String encryptedValue = encrypt(value.toString());
                redisTemplate.opsForValue().set("config:" + key, encryptedValue, 24, TimeUnit.HOURS);
                System.out.println("Config stored in Redis: " + key);
            } else {
                // Use in-memory cache if Redis is not available
                inMemoryCache.put("config:" + key, value);
                System.out.println("Redis not available, storing config in memory: " + key);
            }
        } catch (Exception e) {
            System.err.println("Error setting config " + key + ": " + e.getMessage());
            // Fallback to in-memory storage
            inMemoryCache.put("config:" + key, value);
        }
    }

    public boolean validateConfig() {
        try {
            // Validate critical configurations
            Object dbUrl = getConfig("databaseUrl");
            Object casUrl = getConfig("casBaseUrl");
            
            // Validate LHDN configuration if enabled
            Boolean lhdnEnabled = (Boolean) getConfig("lhdnMyInvoisEnabled");
            if (lhdnEnabled != null && lhdnEnabled) {
                Object lhdnGatewayUrl = getConfig("lhdnGatewayUrl");
                Object lhdnClientId = getConfig("lhdnClientId");
                Object lhdnClientSecret = getConfig("lhdnClientSecret");
                Object lhdnTaxpayerTin = getConfig("lhdnTaxpayerTin");
                
                if (lhdnGatewayUrl == null || lhdnClientId == null || 
                    lhdnClientSecret == null || lhdnTaxpayerTin == null) {
                    return false;
                }
            }
            
            return dbUrl != null && casUrl != null;
        } catch (Exception e) {
            return false;
        }
    }

    private String encrypt(String plainText) throws Exception {
        if (plainText == null) return null;
        
        // Ensure key is exactly 32 characters for AES-256
        String key = encryptionKey;
        if (key.length() < 32) {
            key = String.format("%-32s", key).replace(' ', '0');
        } else if (key.length() > 32) {
            key = key.substring(0, 32);
        }
        
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
        Cipher cipher = Cipher.getInstance("AES");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey);
        byte[] encryptedBytes = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(encryptedBytes);
    }

    private String decrypt(String encryptedText) throws Exception {
        if (encryptedText == null) return null;
        
        // Ensure key is exactly 32 characters for AES-256
        String key = encryptionKey;
        if (key.length() < 32) {
            key = String.format("%-32s", key).replace(' ', '0');
        } else if (key.length() > 32) {
            key = key.substring(0, 32);
        }
        
        SecretKeySpec secretKey = new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "AES");
        Cipher cipher = Cipher.getInstance("AES");
        cipher.init(Cipher.DECRYPT_MODE, secretKey);
        byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
        return new String(decryptedBytes, StandardCharsets.UTF_8);
    }

    private Map<String, Object> initializeDefaultConfigs() {
        Map<String, Object> defaults = new HashMap<>();
        defaults.put("databaseUrl", "http://dynamodb-local:8000");
        defaults.put("cacheUrl", "redis://valkey:6379");
        defaults.put("casBaseUrl", "https://app.penril.net/pineapple-backend");
        defaults.put("taxRate", 10.0);
        defaults.put("batchSchedule", "0 2 * * *");
        defaults.put("companyName", "MulaERP");
        defaults.put("currency", "MYR");
        defaults.put("timezone", "Asia/Kuala_Lumpur");
        
        // Module Configuration (Default enabled modules)
        defaults.put("modulesDashboard", true);
        defaults.put("modulesAccounting", true);
        defaults.put("modulesSales", true);
        defaults.put("modulesInventory", true);
        defaults.put("modulesInvoicing", true);
        defaults.put("modulesReports", true);
        defaults.put("modulesPOS", true);
        defaults.put("modulesHR", true);
        defaults.put("modulesConfiguration", true);
        // Default disabled modules
        defaults.put("modulesManufacturing", false);
        defaults.put("modulesPurchasing", false);
        defaults.put("modulesCRM", false);
        
        // LHDN MyInvois default configuration (disabled by default)
        defaults.put("lhdnMyInvoisEnabled", false);
        defaults.put("lhdnGatewayUrl", "http://localhost:3000");
        defaults.put("lhdnClientId", "");
        defaults.put("lhdnClientSecret", "");
        defaults.put("lhdnEnvironment", "sandbox");
        defaults.put("lhdnTaxpayerTin", "");
        defaults.put("lhdnIdType", "NRIC");
        defaults.put("lhdnIdValue", "");
        defaults.put("lhdnAutoSubmit", false);
        defaults.put("lhdnValidationMode", "strict");
        
        // POS Configuration
        defaults.put("posDeviceCount", 2);
        defaults.put("posReceiptPrinter", "thermal");
        
        // Search Configuration
        defaults.put("searchIndexEnabled", true);
        defaults.put("fullTextSearch", true);
        defaults.put("indexRefreshInterval", 60);
        
        return defaults;
    }
}