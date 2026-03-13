package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatMessageEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class KafkaProducerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaProducerService.class);

    private final KafkaTemplate<String, ChatMessageEvent> kafkaTemplate;

    @Value("${kafka.topic.chat-messages}")
    private String chatMessagesTopic;

    public KafkaProducerService(KafkaTemplate<String, ChatMessageEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Publishes a chat message event to Kafka.
     * Key is chatRoomId — ensures all messages for the same room
     * go to the same partition, preserving order within a room.
     */
    public void publishChatMessage(ChatMessageEvent event) {
        String key = String.valueOf(event.getChatRoomId());

        CompletableFuture<SendResult<String, ChatMessageEvent>> future =
                kafkaTemplate.send(chatMessagesTopic, key, event);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to publish message for room={} sender={}: {}",
                        event.getChatRoomId(), event.getSenderId(), ex.getMessage());
            } else {
                log.debug("Published message for room={} sender={} offset={}",
                        event.getChatRoomId(),
                        event.getSenderId(),
                        result.getRecordMetadata().offset());
            }
        });
    }
}