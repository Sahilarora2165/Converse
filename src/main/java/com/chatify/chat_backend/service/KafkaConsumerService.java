package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatMessageEvent;
import com.chatify.chat_backend.dto.MessageDTO;
import com.chatify.chat_backend.dto.SendMessageDTO;
import com.chatify.chat_backend.entity.Message;
import com.chatify.chat_backend.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Kafka Consumer for HYBRID ARCHITECTURE.
 *
 * RESPONSIBILITY: Persistence only (NO re-broadcast)
 * - WebSocket already delivered message in real-time
 * - This consumer handles durable storage
 *
 * IDEMPOTENCY: messageId prevents duplicate inserts
 * ORDERING: Kafka partitioning by chatRoomId ensures per-room order
 * RETRY: Failed messages go to DLQ for manual inspection
 */
@Service
public class KafkaConsumerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerService.class);

    private final MessageService messageService;
    private final LatencyMetricsService latencyMetricsService;
    private final MessageRepository messageRepository;
    private final KafkaTemplate<String, ChatMessageEvent> kafkaTemplate;

    @Value("${kafka.topic.chat-messages-dlq:chat.messages.dlq}")
    private String dlqTopic;

    // Track processed message IDs for idempotency (in-memory, TTL-based)
    // In production, use Redis with TTL instead
    private final ConcurrentHashMap<String, Instant> processedMessages = new ConcurrentHashMap<>();
    private static final int IDEMPOTENCY_TTL_MINUTES = 10;

    public KafkaConsumerService(MessageService messageService,
                                LatencyMetricsService latencyMetricsService,
                                MessageRepository messageRepository,
                                KafkaTemplate<String, ChatMessageEvent> kafkaTemplate) {
        this.messageService = messageService;
        this.latencyMetricsService = latencyMetricsService;
        this.messageRepository = messageRepository;
        this.kafkaTemplate = kafkaTemplate;

        // Start cleanup thread for idempotency cache
        startIdempotencyCleanup();
    }

    /**
     * Consumes from "chat.messages" topic for PERSISTENCE ONLY.
     *
     * IMPORTANT: Do NOT re-broadcast via WebSocket here!
     * Message was already delivered in real-time via WebSocket controller.
     *
     * This consumer ensures:
     * - Durable storage in database
     * - Idempotency (no duplicate inserts)
     * - Per-room ordering (via Kafka partitioning)
     */
    @KafkaListener(
            topics = "${kafka.topic.chat-messages}",
            groupId = "${spring.kafka.consumer.group-id}",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void consumeChatMessage(
            ChatMessageEvent event,
            @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
            @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
            @Header(KafkaHeaders.OFFSET) long offset,
            Acknowledgment acknowledgment) {

        String messageId = event.getMessageId();
        log.debug("Consuming message {} from {}-{}-{} for room={}",
                messageId, topic, partition, offset, event.getChatRoomId());

        try {
            // IDEMPOTENCY CHECK: Skip if already processed
            if (isAlreadyProcessed(messageId)) {
                log.info("Message {} already processed, skipping (idempotency)", messageId);
                acknowledgment.acknowledge();
                return;
            }

            // Build DTO for persistence
            SendMessageDTO dto = new SendMessageDTO(
                    event.getChatRoomId(),
                    event.getContent(),
                    event.getMessageType(),
                    event.getFileUrl(),
                    event.getFileName(),
                    event.getSentAt()
            );

            // Persist to database
            MessageDTO savedMessage = messageService.sendMessage(dto, event.getSenderId());

            // Mark as processed for idempotency
            markAsProcessed(messageId);

            // Record latency (from client send to DB persist)
            if (event.getSentAt() != null) {
                long persistLatencyMs = Duration.between(event.getSentAt(), Instant.now()).toMillis();
                log.debug("Message {} persisted in {}ms (room={})", 
                        messageId, persistLatencyMs, event.getChatRoomId());
            }

            log.debug("Message {} persisted with DB id={} for room={}",
                    messageId, savedMessage.getId(), event.getChatRoomId());

            // Acknowledge successful processing
            acknowledgment.acknowledge();

        } catch (Exception e) {
            log.error("Failed to persist message {} for room={}: {}",
                    messageId, event.getChatRoomId(), e.getMessage(), e);

            // Handle retry vs DLQ
            if (event.getRetryCount() >= 3) {
                // Max retries reached - send to DLQ
                sendToDlq(event, e);
                acknowledgment.acknowledge(); // Acknowledge to move on
            } else {
                // Don't acknowledge - Kafka will redeliver
                // The retry will increment retryCount
                log.warn("Message {} will be retried (attempt {}/3)", 
                        messageId, event.getRetryCount() + 1);
                // Note: For proper retry with count, use Spring Retry or manual DLQ+reprocess
            }
        }
    }

    /**
     * Check if message was already processed (idempotency).
     */
    private boolean isAlreadyProcessed(String messageId) {
        if (messageId == null) return false;

        Instant processedAt = processedMessages.get(messageId);
        if (processedAt == null) return false;

        // Check if within TTL
        return Duration.between(processedAt, Instant.now()).toMinutes() < IDEMPOTENCY_TTL_MINUTES;
    }

    /**
     * Mark message as processed.
     */
    private void markAsProcessed(String messageId) {
        if (messageId != null) {
            processedMessages.put(messageId, Instant.now());
        }
    }

    /**
     * Send failed message to Dead Letter Queue.
     */
    private void sendToDlq(ChatMessageEvent event, Exception error) {
        try {
            event.setRetryCount(event.getRetryCount() + 1);
            kafkaTemplate.send(dlqTopic, String.valueOf(event.getChatRoomId()), event);
            log.error("Message {} sent to DLQ after {} retries. Error: {}",
                    event.getMessageId(), event.getRetryCount(), error.getMessage());
        } catch (Exception e) {
            log.error("Failed to send message {} to DLQ: {}", event.getMessageId(), e.getMessage());
        }
    }

    /**
     * Periodic cleanup of idempotency cache.
     */
    private void startIdempotencyCleanup() {
        Thread cleanupThread = new Thread(() -> {
            while (true) {
                try {
                    Thread.sleep(60000); // Run every minute
                    Instant cutoff = Instant.now().minus(Duration.ofMinutes(IDEMPOTENCY_TTL_MINUTES));
                    processedMessages.entrySet().removeIf(entry -> entry.getValue().isBefore(cutoff));
                    log.debug("Idempotency cache cleanup: {} entries remaining", processedMessages.size());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }, "idempotency-cleanup");
        cleanupThread.setDaemon(true);
        cleanupThread.start();
    }
}