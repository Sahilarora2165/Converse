package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.LatencyMetricsDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Service for tracking and storing message latency metrics.
 * Uses Redis for time-windowed data storage with automatic TTL.
 */
@Service
public class LatencyMetricsService {

    private static final Logger log = LoggerFactory.getLogger(LatencyMetricsService.class);

    private final RedisTemplate<String, Object> redisTemplate;

    // Redis key prefixes for different time windows
    private static final String LATENCY_KEY_PREFIX = "latency:";
    private static final String LATENCY_1MIN_KEY = LATENCY_KEY_PREFIX + "1min";
    private static final String LATENCY_5MIN_KEY = LATENCY_KEY_PREFIX + "5min";
    private static final String LATENCY_15MIN_KEY = LATENCY_KEY_PREFIX + "15min";
    private static final String LATENCY_HISTORY_KEY = LATENCY_KEY_PREFIX + "history";

    // TTL for each time window (in seconds)
    private static final long TTL_1MIN = 120;      // 2 minutes
    private static final long TTL_5MIN = 360;      // 6 minutes
    private static final long TTL_15MIN = 960;     // 16 minutes
    private static final long TTL_HISTORY = 86400; // 24 hours

    @Value("${metrics.latency.window.minutes:5}")
    private int defaultWindowMinutes;

    public LatencyMetricsService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * Records a latency measurement for a message.
     * Stores the latency value in multiple time windows.
     *
     * @param latencyMs Latency in milliseconds
     */
    public void recordLatency(long latencyMs) {
        if (latencyMs < 0) {
            log.warn("Negative latency value ignored: {}ms", latencyMs);
            return;
        }

        Instant now = Instant.now();
        String timestamp = String.valueOf(now.toEpochMilli());

        // Store in all time windows
        addToTimeWindow(LATENCY_1MIN_KEY, timestamp, latencyMs, TTL_1MIN);
        addToTimeWindow(LATENCY_5MIN_KEY, timestamp, latencyMs, TTL_5MIN);
        addToTimeWindow(LATENCY_15MIN_KEY, timestamp, latencyMs, TTL_15MIN);

        // Add to history for graphing (aggregated per minute)
        addToHistory(now, latencyMs);

        log.debug("Recorded latency: {}ms at {}", latencyMs, timestamp);
    }

    /**
     * Adds a latency value to a time window in Redis.
     */
    private void addToTimeWindow(String key, String timestamp, long latencyMs, long ttlSeconds) {
        // Use a sorted set with timestamp as score for efficient range queries
        redisTemplate.opsForZSet().add(key, latencyMs + ":" + timestamp, now().toEpochMilli());
        redisTemplate.expire(key, ttlSeconds, TimeUnit.SECONDS);
    }

    /**
     * Adds latency to history bucket for graphing.
     * Buckets are per-minute aggregates.
     */
    private void addToHistory(Instant time, long latencyMs) {
        // Round down to the minute for bucketing
        long bucketTimestamp = (time.toEpochMilli() / 60000) * 60000;
        String bucketKey = LATENCY_HISTORY_KEY + ":" + bucketTimestamp;

        // Use Redis hash to store sum and count for averaging
        redisTemplate.opsForHash().increment(bucketKey, "sum", latencyMs);
        redisTemplate.opsForHash().increment(bucketKey, "count", 1);
        redisTemplate.opsForHash().put(bucketKey, "min", Math.min(
                getHashValueAsLong(bucketKey, "min", Long.MAX_VALUE), latencyMs));
        redisTemplate.opsForHash().put(bucketKey, "max", Math.max(
                getHashValueAsLong(bucketKey, "max", 0L), latencyMs));

        redisTemplate.expire(bucketKey, TTL_HISTORY, TimeUnit.SECONDS);
    }

    private long getHashValueAsLong(String key, String field, long defaultValue) {
        Object value = redisTemplate.opsForHash().get(key, field);
        if (value == null) return defaultValue;
        if (value instanceof Number) return ((Number) value).longValue();
        return Long.parseLong(value.toString());
    }

    /**
     * Gets current latency metrics for the specified time window.
     *
     * @param windowMinutes Time window in minutes (1, 5, or 15)
     * @return Current latency metrics
     */
    public LatencyMetricsDTO.CurrentResponse getCurrentMetrics(int windowMinutes) {
        String key = getWindowKey(windowMinutes);
        if (key == null) {
            key = getWindowKey(defaultWindowMinutes);
        }

        Set<Object> values = redisTemplate.opsForZSet().range(key, 0, -1);
        if (values == null || values.isEmpty()) {
            return new LatencyMetricsDTO.CurrentResponse(
                    0.0, 0L, 0L, 0L, Instant.now(), 0.0, 0.0, 0.0
            );
        }

        List<Long> latencies = values.stream()
                .map(obj -> {
                    String[] parts = obj.toString().split(":");
                    return Long.parseLong(parts[0]);
                })
                .sorted()
                .collect(Collectors.toList());

        double avg = latencies.stream().mapToLong(Long::longValue).average().orElse(0.0);
        long min = latencies.get(0);
        long max = latencies.get(latencies.size() - 1);

        // Calculate percentiles
        double p50 = calculatePercentile(latencies, 50);
        double p95 = calculatePercentile(latencies, 95);
        double p99 = calculatePercentile(latencies, 99);

        return new LatencyMetricsDTO.CurrentResponse(
                Math.round(avg * 100.0) / 100.0,
                min,
                max,
                (long) latencies.size(),
                Instant.now(),
                Math.round(p50 * 100.0) / 100.0,
                Math.round(p95 * 100.0) / 100.0,
                Math.round(p99 * 100.0) / 100.0
        );
    }

    /**
     * Calculates a percentile value from a sorted list of latencies.
     */
    private double calculatePercentile(List<Long> sortedLatencies, double percentile) {
        if (sortedLatencies.isEmpty()) return 0.0;
        if (sortedLatencies.size() == 1) return sortedLatencies.get(0);

        double index = (percentile / 100.0) * (sortedLatencies.size() - 1);
        int lower = (int) Math.floor(index);
        int upper = (int) Math.ceil(index);

        if (lower == upper) {
            return sortedLatencies.get(lower);
        }

        double weight = index - lower;
        return sortedLatencies.get(lower) * (1 - weight) + sortedLatencies.get(upper) * weight;
    }

    /**
     * Gets historical latency data for graphing.
     *
     * @param windowMinutes Time window in minutes
     * @return Historical latency data points
     */
    public LatencyMetricsDTO.HistoryResponse getHistoricalMetrics(int windowMinutes) {
        long now = Instant.now().toEpochMilli();
        long fromTime = now - (windowMinutes * 60 * 1000L);

        // Find all bucket keys in the time range
        Set<String> keys = redisTemplate.keys(LATENCY_HISTORY_KEY + ":*");
        if (keys == null || keys.isEmpty()) {
            return new LatencyMetricsDTO.HistoryResponse(
                    List.of(), windowMinutes, Instant.ofEpochMilli(fromTime), Instant.ofEpochMilli(now)
            );
        }

        List<LatencyMetricsDTO.LatencyDataPoint> dataPoints = keys.stream()
                .filter(key -> {
                    long timestamp = extractTimestampFromKey(key);
                    return timestamp >= fromTime && timestamp <= now;
                })
                .map(key -> {
                    long timestamp = extractTimestampFromKey(key);
                    Map<Object, Object> bucket = redisTemplate.opsForHash().entries(key);

                    long sum = getLongFromMap(bucket, "sum", 0);
                    long count = getLongFromMap(bucket, "count", 0);
                    double avg = count > 0 ? (double) sum / count : 0.0;

                    return new LatencyMetricsDTO.LatencyDataPoint(
                            Instant.ofEpochMilli(timestamp),
                            Math.round(avg * 100.0) / 100.0,
                            count
                    );
                })
                .sorted(Comparator.comparing(LatencyMetricsDTO.LatencyDataPoint::getTimestamp))
                .collect(Collectors.toList());

        return new LatencyMetricsDTO.HistoryResponse(
                dataPoints,
                windowMinutes,
                Instant.ofEpochMilli(fromTime),
                Instant.ofEpochMilli(now)
        );
    }

    private long extractTimestampFromKey(String key) {
        String[] parts = key.split(":");
        return Long.parseLong(parts[parts.length - 1]);
    }

    private long getLongFromMap(Map<Object, Object> map, String key, long defaultValue) {
        Object value = map.get(key);
        if (value == null) return defaultValue;
        if (value instanceof Number) return ((Number) value).longValue();
        try {
            return Long.parseLong(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /**
     * Gets the Redis key for a given time window.
     */
    private String getWindowKey(int windowMinutes) {
        return switch (windowMinutes) {
            case 1 -> LATENCY_1MIN_KEY;
            case 5 -> LATENCY_5MIN_KEY;
            case 15 -> LATENCY_15MIN_KEY;
            default -> LATENCY_5MIN_KEY;
        };
    }

    /**
     * Clears all latency metrics data.
     * Useful for testing or resetting metrics.
     */
    public void clearAllMetrics() {
        Set<String> keys = redisTemplate.keys(LATENCY_KEY_PREFIX + "*");
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        log.info("Cleared all latency metrics");
    }

    /**
     * Scheduled task to clean up old data points from time windows.
     * Runs every minute.
     */
    @Scheduled(fixedRate = 60000)
    public void cleanupOldDataPoints() {
        long now = Instant.now().toEpochMilli();

        // Clean up each time window
        cleanupTimeWindow(LATENCY_1MIN_KEY, now - 60000);
        cleanupTimeWindow(LATENCY_5MIN_KEY, now - 300000);
        cleanupTimeWindow(LATENCY_15MIN_KEY, now - 900000);
    }

    private void cleanupTimeWindow(String key, long olderThan) {
        redisTemplate.opsForZSet().removeRangeByScore(key, 0, olderThan);
    }

    private Instant now() {
        return Instant.now();
    }
}
