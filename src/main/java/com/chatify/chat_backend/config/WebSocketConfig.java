package com.chatify.chat_backend.config;

import com.chatify.chat_backend.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;

@Configuration
@EnableWebSocketMessageBroker
@Order(Ordered.HIGHEST_PRECEDENCE + 99)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final Logger log = LoggerFactory.getLogger(WebSocketConfig.class);

    private final JwtUtil jwtUtil;

    @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    public WebSocketConfig(JwtUtil jwtUtil){
        this.jwtUtil = jwtUtil;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigins.split(","))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/user")
                .setHeartbeatValue(new long[]{10000, 10000})
                .setTaskScheduler(heartbeatScheduler());
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Bean
    public ThreadPoolTaskScheduler heartbeatScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("wss-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");

                    log.debug("WebSocket CONNECT request received");

                    if (authHeader != null && authHeader.toLowerCase().startsWith("bearer")) {
                        String token = authHeader.replace("Bearer", "").trim();

                        try {
                            String email = jwtUtil.extractUsername(token);

                            if (email != null && jwtUtil.isTokenValid(token, email)) {
                                UsernamePasswordAuthenticationToken auth =
                                        new UsernamePasswordAuthenticationToken(email, null, List.of());

                                accessor.setUser(auth);
                                log.debug("WebSocket authenticated user: {}", email);
                            } else {
                                log.warn("WebSocket authentication failed: invalid token");
                                throw new IllegalArgumentException("Invalid JWT token");
                            }
                        } catch (IllegalArgumentException e) {
                            throw e;
                        } catch (Exception e) {
                            log.warn("Error parsing JWT in WebSocket: {}", e.getMessage());
                            throw new IllegalArgumentException("JWT parsing failed");
                        }
                    } else {
                        log.warn("No Authorization header found in WebSocket CONNECT frame");
                        throw new IllegalArgumentException("Missing Authorization header");
                    }
                }
                return message;
            }
        });
    }
}