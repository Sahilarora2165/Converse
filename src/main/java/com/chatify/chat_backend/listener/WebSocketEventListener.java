package com.chatify.chat_backend.listener;

import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.service.PresenceService;
import com.chatify.chat_backend.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final PresenceService presenceService;
    private final UserService userService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();

        if (principal == null) {  // NEW: Early return on null—skips unauth attempts.
            log.warn("Unauthenticated connect attempt ignored");
            return;
        }

        String email = principal.getName();
        log.info("User connected: {}", email);
        User user = userService.getUserEntityByEmail(email);
        presenceService.userConnected(user.getId());
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();

        if (principal == null) {  // NEW: Early return—consistent security.
            log.warn("Unauthenticated disconnect attempt ignored");
            return;
        }

        String email = principal.getName();
        log.info("User disconnected: {}", email);
        User user = userService.getUserEntityByEmail(email);
        presenceService.userDisconnected(user.getId());
    }
}