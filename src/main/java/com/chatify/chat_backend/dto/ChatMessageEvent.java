package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Event published to Kafka topic "chat.messages".
 * Contains everything the consumer needs to save the message and broadcast it —
 * no DB lookups required on the consumer side except for entity resolution.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageEvent {

    private Long chatRoomId;
    private Long senderId;

    private String content;
    private MessageType messageType;
    private String fileUrl;
    private String fileName;

    /**
     * Timestamp when the message was sent from the client.
     * Used for end-to-end latency calculation.
     */
    private Instant sentAt;
}