package com.mulaerp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;

@Configuration
@ConditionalOnProperty(name = "spring.data.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisConfig {

    @Value("${spring.data.redis.host:valkey}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.password:mulaerp-redis-password}")
    private String redisPassword;

    @Bean
    @ConditionalOnMissingBean(RedisConnectionFactory.class)
    public RedisConnectionFactory redisConnectionFactory() {
        try {
            System.out.println("Creating Redis connection to " + redisHost + ":" + redisPort);
            LettuceConnectionFactory factory = new LettuceConnectionFactory(redisHost, redisPort);
            if (redisPassword != null && !redisPassword.isEmpty() && !"".equals(redisPassword.trim())) {
                factory.setPassword(redisPassword);
                System.out.println("Redis password configured");
            }
            factory.setValidateConnection(false);
            factory.afterPropertiesSet();
            System.out.println("Redis connection factory created successfully");
            return factory;
        } catch (Exception e) {
            System.err.println("Failed to create Redis connection factory: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    @Bean
    @ConditionalOnMissingBean(name = "redisTemplate")
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        try {
            System.out.println("Creating Redis template");
            RedisTemplate<String, Object> template = new RedisTemplate<>();
            template.setConnectionFactory(connectionFactory);
            
            // Use String serializer for keys
            template.setKeySerializer(new StringRedisSerializer());
            template.setHashKeySerializer(new StringRedisSerializer());
            
            // Use JSON serializer for values
            template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
            template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
            
            template.setDefaultSerializer(new GenericJackson2JsonRedisSerializer());
            template.afterPropertiesSet();
            System.out.println("Redis template created successfully");
            return template;
        } catch (Exception e) {
            System.err.println("Failed to create Redis template: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
}