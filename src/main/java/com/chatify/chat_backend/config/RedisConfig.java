package com.chatify.chat_backend.config;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableCaching
public class RedisConfig {

    // shared ObjectMapper — handles Java 8 date/time types (LocalDateTime, Instant etc.)
    // and stores type info so Redis knows how to deserialize back to the right class
    private ObjectMapper redisObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // needed for LocalDateTime, Instant in your DTOs
        mapper.registerModule(new JavaTimeModule());

        // stores class type in JSON so deserialization works correctly
        // without this, Redis returns a LinkedHashMap instead of your DTO
        mapper.activateDefaultTyping(
                LaissezFaireSubTypeValidator.instance,
                ObjectMapper.DefaultTyping.NON_FINAL,
                JsonTypeInfo.As.PROPERTY
        );

        return mapper;
    }

    // RedisTemplate — used directly in PresenceService for TTL-based presence keys
    // String keys, JSON values
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(redisObjectMapper());

        // keys are plain strings like "presence:42"
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(jsonSerializer);

        // same for hash operations
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }

    // CacheManager — used by @Cacheable and @CacheEvict in UserService
    // each cache can have its own TTL defined below
    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {

        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(redisObjectMapper());

        // default config — applies to any cache not listed in perCacheTtl below
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration
                .defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeKeysWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(new StringRedisSerializer())
                )
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(jsonSerializer)
                )
                // don't cache nulls — keeps cache clean
                .disableCachingNullValues();

        // per-cache TTL overrides
        // add more caches here as the app grows
        Map<String, RedisCacheConfiguration> perCacheTtl = new HashMap<>();

        // user profiles — 5 min, gets evicted on profile update anyway
        perCacheTtl.put("users",
                defaultConfig.entryTtl(Duration.ofMinutes(5)));

        // user lookup by email — same TTL as by id
        perCacheTtl.put("users-by-email",
                defaultConfig.entryTtl(Duration.ofMinutes(5)));

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(perCacheTtl)
                .build();
    }
}