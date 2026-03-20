package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Event published to Kafka topic "chat.messages".
 * Contains everything the consumer needs to save the message.
 *
 * HYBRID ARCHITECTURE:
 * - WebSocket: Immediate broadcast to subscribers (real-time)
 * - Kafka: Reliable persistence with ordering guarantees
 *
 * IDEMPOTENCY: messageId ensures duplicate messages are handled correctly
 * ORDERING: chatRoomId as Kafka key ensures per-room ordering
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageEvent {

    /**
     * Unique message ID for idempotency.
     * Generated at WebSocket receive time.
     */
    private String messageId;

    private Long chatRoomId;
    private Long senderId;
    private String senderUsername;

    private String content;
    private MessageType messageType;
    private String fileUrl;
    private String fileName;

    /**
     * Timestamp when the message was sent from the client.
     * Used for end-to-end latency calculation.
     */
    private Instant sentAt;

    /**
     * Server timestamp when WebSocket received the message.
     * Used for server-side processing time tracking.
     */
    private Instant serverReceivedAt;

    private Long replyToMessageId;

    /**
     * Retry count for failed processing attempts.
     */
    private int retryCount;

    /**
     * Generates a unique message ID.
     */
    public static String generateMessageId() {
        return UUID.randomUUID().toString();
    }
}