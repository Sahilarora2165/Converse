package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.LatencyMetricsDTO;
import com.chatify.chat_backend.service.LatencyMetricsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller for exposing latency metrics.
 * Provides endpoints for current and historical latency data.
 */
@RestController
@RequestMapping("/api/metrics/latency")
public class MetricsController {

    private final LatencyMetricsService latencyMetricsService;

    public MetricsController(LatencyMetricsService latencyMetricsService) {
        this.latencyMetricsService = latencyMetricsService;
    }

    /**
     * Gets current latency metrics.
     *
     * @param windowMinutes Time window in minutes (1, 5, or 15). Default is 5.
     * @param authentication The authenticated user
     * @return Current latency statistics
     */
    @GetMapping("/current")
    public ResponseEntity<LatencyMetricsDTO.CurrentResponse> getCurrentMetrics(
            @RequestParam(defaultValue = "5") int windowMinutes,
            Authentication authentication) {
        
        LatencyMetricsDTO.CurrentResponse metrics = latencyMetricsService.getCurrentMetrics(windowMinutes);
        return ResponseEntity.ok(metrics);
    }

    /**
     * Gets historical latency data for graphing.
     *
     * @param windowMinutes Time window in minutes (1, 5, or 15). Default is 5.
     * @param authentication The authenticated user
     * @return Historical latency data points
     */
    @GetMapping("/history")
    public ResponseEntity<LatencyMetricsDTO.HistoryResponse> getHistoricalMetrics(
            @RequestParam(defaultValue = "5") int windowMinutes,
            Authentication authentication) {
        
        LatencyMetricsDTO.HistoryResponse history = latencyMetricsService.getHistoricalMetrics(windowMinutes);
        return ResponseEntity.ok(history);
    }

    /**
     * Gets comprehensive latency metrics including current stats and recent history.
     *
     * @param authentication The authenticated user
     * @return Combined latency metrics
     */
    @GetMapping("/summary")
    public ResponseEntity<LatencySummary> getMetricsSummary(Authentication authentication) {
        LatencyMetricsDTO.CurrentResponse current = latencyMetricsService.getCurrentMetrics(5);
        LatencyMetricsDTO.HistoryResponse history = latencyMetricsService.getHistoricalMetrics(5);
        
        return ResponseEntity.ok(new LatencySummary(current, history));
    }

    /**
     * Clears all latency metrics (admin only - for testing purposes).
     *
     * @param authentication The authenticated user
     * @return Success message
     */
    @DeleteMapping("/clear")
    public ResponseEntity<String> clearMetrics(Authentication authentication) {
        latencyMetricsService.clearAllMetrics();
        return ResponseEntity.ok("All latency metrics cleared");
    }

    /**
     * Summary wrapper for combined metrics response.
     */
    public record LatencySummary(
            LatencyMetricsDTO.CurrentResponse current,
            LatencyMetricsDTO.HistoryResponse history
    ) {}
}
