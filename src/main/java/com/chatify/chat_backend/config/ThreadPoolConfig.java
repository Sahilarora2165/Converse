package com.chatify.chat_backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.Executor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Thread pool configuration for isolating DB operations from WebSocket delivery operations.
 *
 * ARCHITECTURE:
 * - dbExecutor: Dedicated thread pool for database operations
 * - wsExecutor: Dedicated thread pool for WebSocket broadcast operations
 *
 * BENEFITS:
 * - DB slowness will never block WebSocket message delivery
 * - Each concern runs on its own isolated thread pool
 * - Better resource management and monitoring
 */
@Configuration
@EnableAsync
public class ThreadPoolConfig {

    /**
     * Thread pool for database operations.
     * Core: 5, Max: 10, Queue: 100
     */
    @Bean("dbExecutor")
    public Executor dbExecutor() {
        ThreadPoolExecutor executor = new ThreadPoolExecutor(
                5,
                10,
                60L,
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
        executor.setThreadFactory(r -> {
            Thread thread = new Thread(r);
            thread.setName("db-thread-" + thread.getId());
            return thread;
        });
        return executor;
    }

    /**
     * Thread pool for WebSocket delivery operations.
     * Core: 10, Max: 20, Queue: 200
     */
    @Bean("wsExecutor")
    public Executor wsExecutor() {
        ThreadPoolExecutor executor = new ThreadPoolExecutor(
                10,
                20,
                60L,
                TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(200),
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
        executor.setThreadFactory(r -> {
            Thread thread = new Thread(r);
            thread.setName("ws-thread-" + thread.getId());
            return thread;
        });
        return executor;
    }
}
