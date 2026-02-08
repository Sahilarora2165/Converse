package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.OnlineStatusDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.UserStatus;
import com.chatify.chat_backend.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Service for managing user presence (online/offline status).
 *
 * NOTE: This implementation uses an in-memory ConcurrentHashMap for storing presence data.
 * For production deployments with multiple server instances, consider using a distributed
 * cache like Redis to ensure presence data is shared across all instances.
 */
@Service
public class PresenceService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserService userService;
    private final ChatRoomService chatRoomService;  // NEW: Inject for per-chat targeting.

    // CHANGED: Session count per user instead of DTO map—handles multi-tab reliably.
    private final Map<Long, AtomicInteger> activeSessions = new ConcurrentHashMap<>();
    // NEW: Cache presence DTOs for quick access (still in-memory; Redis later).
    private final Map<Long, OnlineStatusDTO> userPresence = new ConcurrentHashMap<>();

    public PresenceService(UserRepository userRepository,
                           SimpMessagingTemplate messagingTemplate,
                           UserService userService,
                           ChatRoomService chatRoomService) {  // NEW: Add ChatRoomService dep.
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.userService = userService;
        this.chatRoomService = chatRoomService;
    }

    @Transactional
    public OnlineStatusDTO updateUserPresence(Long userId, UserStatus status) {
        User user = userService.getUserEntityById(userId);
        user.setStatus(status);

        if (status == UserStatus.OFFLINE) {
            user.setLastSeen(LocalDateTime.now());
        }

        userRepository.save(user);

        OnlineStatusDTO presenceDTO = new OnlineStatusDTO(
                user.getId(),
                user.getUsername(),
                status,
                user.getLastSeen()
        );

        userPresence.put(userId, presenceDTO);
        return presenceDTO;
    }

    @Transactional(readOnly = true)  // NEW: Add transactional for consistency.
    public OnlineStatusDTO getUserPresence(Long userId) {
        if (userPresence.containsKey(userId)) {
            return userPresence.get(userId);
        }

        User user = userService.getUserEntityById(userId);
        OnlineStatusDTO presenceDTO = new OnlineStatusDTO(
                user.getId(),
                user.getUsername(),
                user.getStatus(),
                user.getLastSeen()
        );

        userPresence.put(userId, presenceDTO);
        return presenceDTO;
    }

    public void broadcastPresenceChange(OnlineStatusDTO presenceDTO) {
        // CHANGED: Target per-chat instead of global /topic/presence—scales better, notifies only relevant users.
        List<Long> chatRoomIds = chatRoomService.getChatRoomIdsForUser(presenceDTO.getUserId());  // NEW: Assume this method exists (add if not: query user's rooms).
        for (Long roomId : chatRoomIds) {
            messagingTemplate.convertAndSend("/topic/chatroom/" + roomId + "/presence", presenceDTO);
        }
    }

    @Transactional
    public void userConnected(Long userId) {
        AtomicInteger sessionCount = activeSessions.computeIfAbsent(userId, k -> new AtomicInteger(0));
        if (sessionCount.incrementAndGet() == 1) {  // NEW: Only update/broadcast on first session.
            OnlineStatusDTO presenceDTO = updateUserPresence(userId, UserStatus.ONLINE);
            broadcastPresenceChange(presenceDTO);
        }
    }

    @Transactional
    public void userDisconnected(Long userId) {
        AtomicInteger sessionCount = activeSessions.get(userId);
        if (sessionCount != null && sessionCount.decrementAndGet() <= 0) {  // NEW: Only update/broadcast on last session close.
            activeSessions.remove(userId);
            OnlineStatusDTO presenceDTO = updateUserPresence(userId, UserStatus.OFFLINE);
            broadcastPresenceChange(presenceDTO);
            userPresence.remove(userId);
        }
    }

    public Map<Long, OnlineStatusDTO> getAllOnlineUsers() {
        return new ConcurrentHashMap<>(userPresence);
    }
}