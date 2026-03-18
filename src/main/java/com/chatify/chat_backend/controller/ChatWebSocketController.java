package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.*;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.service.ChatRoomService;
import com.chatify.chat_backend.service.KafkaProducerService;
import com.chatify.chat_backend.service.LatencyMetricsService;
import com.chatify.chat_backend.service.MessageService;
import com.chatify.chat_backend.service.PresenceService;
import com.chatify.chat_backend.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.concurrent.CompletableFuture;

@Controller
@PreAuthorize("isAuthenticated()")
public class ChatWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketController.class);

    private final SimpMessageSendingOperations messagingTemplate;
    private final MessageService messageService;
    private final UserService userService;
    private final ChatRoomService chatRoomService;
    private final PresenceService presenceService;
    private final KafkaProducerService kafkaProducerService;
    private final LatencyMetricsService latencyMetricsService;

    public ChatWebSocketController(SimpMessageSendingOperations messagingTemplate,
                                   MessageService messageService,
                                   UserService userService,
                                   ChatRoomService chatRoomService,
                                   PresenceService presenceService,
                                   KafkaProducerService kafkaProducerService,
                                   LatencyMetricsService latencyMetricsService) {
        this.messagingTemplate = messagingTemplate;
        this.messageService = messageService;
        this.userService = userService;
        this.chatRoomService = chatRoomService;
        this.presenceService = presenceService;
        this.kafkaProducerService = kafkaProducerService;
        this.latencyMetricsService = latencyMetricsService;
    }

    /**
     * Legacy handler — kept for backward compatibility.
     * OPTIMIZED: Direct WebSocket delivery + async persistence.
     */
    @MessageMapping("/chat.sendMessage")
    public void sendMessage(@Payload SendMessageDTO messageDTO, Principal principal) {
        if (principal == null) return;

        String email = principal.getName();
        User sender = userService.getUserEntityByEmail(email);

        if (!chatRoomService.isUserInChatRoom(messageDTO.getChatRoomId(), sender.getId())) {
            log.warn("User {} is not in room {}", sender.getId(), messageDTO.getChatRoomId());
            return;
        }

        // Record latency immediately
        if (messageDTO.getSentAt() != null) {
            long latencyMs = Duration.between(messageDTO.getSentAt(), Instant.now()).toMillis();
            latencyMetricsService.recordLatency(latencyMs);
        }

        // Save to DB asynchronously - don't block the critical path
        CompletableFuture.runAsync(() -> {
            try {
                messageService.sendMessage(messageDTO, sender.getId());
            } catch (Exception e) {
                log.error("Failed to save message: {}", e.getMessage());
            }
        });

        // Broadcast immediately via WebSocket (before DB save)
        MessageDTO broadcastMessage = createQuickMessageDTO(messageDTO, sender);
        messagingTemplate.convertAndSend("/topic/chatroom/" + messageDTO.getChatRoomId(), broadcastMessage);
    }

    /**
     * Primary handler used by the frontend (WebSocketContext.jsx).
     * OPTIMIZED: Direct WebSocket delivery + async persistence for minimal latency.
     */
    @MessageMapping("/chat/{roomId}/sendMessage")
    public void sendMessage(
            @DestinationVariable Long roomId,
            @Payload SendMessageDTO sendMessageDTO,
            Principal principal) {

        if (principal == null) {
            log.warn("WebSocket message rejected: principal is null for room {}", roomId);
            return;
        }

        long startTime = System.nanoTime();
        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        if (!chatRoomService.isUserInChatRoom(roomId, user.getId())) {
            log.warn("User {} is not in room {}", user.getId(), roomId);
            return;
        }

        // Record latency immediately (critical for performance tracking)
        if (sendMessageDTO.getSentAt() != null) {
            long latencyMs = Duration.between(sendMessageDTO.getSentAt(), Instant.now()).toMillis();
            latencyMetricsService.recordLatency(latencyMs);
        }

        // Create broadcast message immediately
        MessageDTO broadcastMessage = createQuickMessageDTO(sendMessageDTO, user);
        
        // Broadcast FIRST - this is the critical path for real-time delivery
        messagingTemplate.convertAndSend("/topic/chatroom/" + roomId, broadcastMessage);
        
        // Persist to database asynchronously (non-blocking)
        final Long senderId = user.getId();
        CompletableFuture.runAsync(() -> {
            try {
                messageService.sendMessage(sendMessageDTO, senderId);
            } catch (Exception e) {
                log.error("Failed to persist message for room={}: {}", roomId, e.getMessage());
            }
        });

        long elapsedMs = (System.nanoTime() - startTime) / 1_000_000;
        log.debug("Message processed in {}ms for room={}", elapsedMs, roomId);
    }

    /**
     * Creates a MessageDTO for immediate broadcast without waiting for DB.
     * Uses a temporary negative ID that will be replaced when DB save completes.
     */
    private MessageDTO createQuickMessageDTO(SendMessageDTO dto, User sender) {
        return new MessageDTO(
                -System.nanoTime(), // Temporary ID (negative to avoid collision)
                dto.getContent() != null ? dto.getContent() : "",
                dto.getMessageType(),
                dto.getFileUrl(),
                dto.getFileName(),
                sender.getId(),
                sender.getUsername(),
                dto.getChatRoomId(),
                LocalDateTime.now(),
                java.util.Set.of(), // Empty read-by set
                com.chatify.chat_backend.entity.enums.MessageStatus.SENT
        );
    }

    @MessageMapping("/chat.read/{messageId}")
    public void handleReadReceipt(@DestinationVariable Long messageId, Principal principal) {
        if (principal == null) return;

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageDTO message = messageService.markMessageAsRead(messageId, user.getId());

        ReadReceiptDTO readReceipt = new ReadReceiptDTO(
                messageId,
                user.getId(),
                user.getUsername(),
                message.getChatRoomId(),
                LocalDateTime.now());

        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + message.getChatRoomId() + "/read",
                readReceipt);
    }

    @MessageMapping("/presence.update")
    public void updatePresence(@Payload OnlineStatusDTO statusDTO, Principal principal) {
        if (principal == null) return;

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        OnlineStatusDTO updatedStatus = presenceService.updateUserPresence(user.getId(), statusDTO.getStatus());
        presenceService.broadcastPresenceChange(updatedStatus);
    }

    @MessageMapping("/chat.delivered")
    public void handleDeliveredAck(@Payload MessageDeliveredAckDTO ack, Principal principal) {
        if (principal == null) return;

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageDeliveryUpdateDTO update = messageService.markMessagesAsDelivered(
                ack.getChatRoomId(),
                user.getId(),
                ack.getLastDeliveredMessageId());

        if (update != null) {
            messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + ack.getChatRoomId() + "/delivery",
                    update);
        }
    }

    @MessageMapping("/chat.seen")
    public void handleSeenAck(@Payload MessageSeenAckDTO ack, Principal principal) {
        if (principal == null) return;

        String email = principal.getName();
        User user = userService.getUserEntityByEmail(email);

        MessageSeenUpdateDTO update = messageService.markMessagesAsSeen(
                ack.getChatRoomId(),
                user.getId(),
                ack.getLastSeenMessageId());

        if (update != null) {
            messagingTemplate.convertAndSend(
                    "/topic/chatroom/" + ack.getChatRoomId() + "/seen",
                    update);
        }
    }
}