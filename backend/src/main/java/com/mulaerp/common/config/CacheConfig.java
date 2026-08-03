package com.mulaerp.common.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;

/**
 * Redis Cache Configuration
 * Phase 5.1: Performance Optimization
 *
 * NOTE: GenericJackson2JsonRedisSerializer's default (no-arg) constructor builds its own
 * internal ObjectMapper that does NOT register the JavaTimeModule. Any cached DTO containing a
 * java.time type (e.g. LocalDateTime createdAt/updatedAt on BaseEntity-derived DTOs) then fails
 * to serialize on cache write, surfacing as a 500 on any @Cacheable GET (e.g.
 * GET /api/v1/products/{id}) even though the equivalent POST - which never touches the cache -
 * works fine. We supply our own ObjectMapper with JavaTimeModule registered, and re-enable the
 * default typing GenericJackson2JsonRedisSerializer would otherwise apply automatically, so
 * cached values still deserialize back to their original DTO type.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        ObjectMapper redisObjectMapper = new ObjectMapper();
        redisObjectMapper.registerModule(new JavaTimeModule());
        redisObjectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        redisObjectMapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer(redisObjectMapper);

        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(30)) // Default TTL: 30 minutes
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
                )
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair.fromSerializer(jsonSerializer)
                )
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .withCacheConfiguration("products", config.entryTtl(Duration.ofHours(1)))
                .withCacheConfiguration("customers", config.entryTtl(Duration.ofHours(1)))
                .withCacheConfiguration("suppliers", config.entryTtl(Duration.ofHours(1)))
                .withCacheConfiguration("categories", config.entryTtl(Duration.ofHours(2)))
                .withCacheConfiguration("dashboard", config.entryTtl(Duration.ofMinutes(5)))
                .withCacheConfiguration("reports", config.entryTtl(Duration.ofMinutes(15)))
                .build();
    }
}
