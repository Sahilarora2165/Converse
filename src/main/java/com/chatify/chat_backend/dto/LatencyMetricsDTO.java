package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * DTO for latency metrics data.
 * Used to expose latency statistics via REST API.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LatencyMetricsDTO {

    /**
     * Current average latency in milliseconds.
     */
    private Double avgLatencyMs;

    /**
     * Minimum latency in the current window.
     */
    private Long minLatencyMs;

    /**
     * Maximum latency in the current window.
     */
    private Long maxLatencyMs;

    /**
     * Number of messages used to calculate these metrics.
     */
    private Long messageCount;

    /**
     * Timestamp when these metrics were calculated.
     */
    private Instant timestamp;

    /**
     * Time window in minutes for these metrics.
     */
    private Integer windowMinutes;

    /**
     * Nested class for historical data points.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatencyDataPoint {
        private Instant timestamp;
        private Double latencyMs;
        private Long messageCount;
    }

    /**
     * Response wrapper for historical latency data.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HistoryResponse {
        private List<LatencyDataPoint> dataPoints;
        private Integer windowMinutes;
        private Instant fromTime;
        private Instant toTime;
    }

    /**
     * Response for current latency stats.
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CurrentResponse {
        private Double avgLatencyMs;
        private Long minLatencyMs;
        private Long maxLatencyMs;
        private Long messageCount;
        private Instant timestamp;
        private Double p50LatencyMs;
        private Double p95LatencyMs;
        private Double p99LatencyMs;
    }
}
