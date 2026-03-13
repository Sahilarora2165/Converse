package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatMessageEvent;
import com.chatify.chat_backend.dto.MessageDTO;
import com.chatify.chat_backend.dto.SendMessageDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Service;

@Service
public class KafkaConsumerService {

    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerService.class);

    private final MessageService messageService;
    private final SimpMessageSendingOperations messagingTemplate;

    public KafkaConsumerService(MessageService messageService,
                                SimpMessageSendingOperations messagingTemplate) {
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Consumes from "chat.messages" topic.
     * 1. Saves the message to the database via MessageService
     * 2. Broadcasts the saved MessageDTO to all WebSocket subscribers of the room
     *
     * groupId matches spring.kafka.consumer.group-id in application.properties.
     * containerFactory is the default Spring Boot auto-configured one.
     */
    @KafkaListener(
            topics = "${kafka.topic.chat-messages}",
            groupId = "${spring.kafka.consumer.group-id}"
    )
    public void consumeChatMessage(ChatMessageEvent event) {
        log.debug("Consuming message event for room={} sender={}",
                event.getChatRoomId(), event.getSenderId());

        try {
            // Build the SendMessageDTO that MessageService expects
            SendMessageDTO dto = new SendMessageDTO(
                    event.getChatRoomId(),
                    event.getContent(),
                    event.getMessageType(),
                    event.getFileUrl(),
                    event.getFileName()
            );

            // Save to DB
            MessageDTO savedMessage = messageService.sendMessage(dto, event.getSenderId());

            // Broadcast to all WebSocket subscribers of this room
            messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + event.getChatRoomId(),
                    savedMessage
            );

            log.debug("Message saved and broadcast for room={} messageId={}",
                    event.getChatRoomId(), savedMessage.getId());

        } catch (Exception e) {
            log.error("Failed to process message event for room={} sender={}: {}",
                    event.getChatRoomId(), event.getSenderId(), e.getMessage(), e);
            // Re-throw so Kafka retries based on consumer error handler config.
            // Without a DeadLetterPublishingRecoverer, it will retry then log and skip.
            throw new RuntimeException("Message processing failed", e);
        }
    }
}