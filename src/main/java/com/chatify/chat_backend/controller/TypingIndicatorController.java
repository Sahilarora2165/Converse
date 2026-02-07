package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.TypingIndicatorDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.service.UserService;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;

@Controller
public class TypingIndicatorController {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserService userService;

    public TypingIndicatorController(SimpMessagingTemplate messagingTemplate, UserService userService) {
        this.messagingTemplate = messagingTemplate;
        this.userService = userService;
    }

    /**
     * Handle typing indicator updates
     * Client sends to: /app/chat/typing/{chatRoomId}
     * Server broadcasts to: /topic/chatroom/{chatRoomId}/typing
     */
    @MessageMapping("/chat/typing/{chatRoomId}")
    public void handleTyping(
            @DestinationVariable Long chatRoomId,
            @Payload TypingIndicatorDTO typingIndicator,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        // Get authenticated user from WebSocket session
        Authentication authentication = (Authentication) headerAccessor.getUser();
        if (authentication == null) return;

        String email = authentication.getName();
        UserDTO user = userService.getUserByEmail(email);

        // Create response with user info
        TypingIndicatorDTO response = new TypingIndicatorDTO();
        response.setUserId(user.getId());
        response.setUsername(user.getUsername());
        response.setTyping(typingIndicator.isTyping());
        response.setChatRoomId(chatRoomId);

        // Broadcast to all users in the chat room
        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + chatRoomId + "/typing",
                response
        );
    }
}