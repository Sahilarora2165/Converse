package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.OnlineStatusDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.UserStatus;
import com.chatify.chat_backend.repository.UserRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class PresenceService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserService userService;
    private final RedisTemplate<String, Object> redisTemplate;

    // all presence keys follow this pattern — makes bulk scan easy
    private static final String PRESENCE_KEY_PREFIX = "presence:";

    // how long a user stays ONLINE without a heartbeat refresh
    // WebSocket disconnect fires before this, but this acts as a safety net
    private static final long PRESENCE_TTL_SECONDS = 60;

    public PresenceService(UserRepository userRepository,
                           SimpMessagingTemplate messagingTemplate,
                           UserService userService,
                           RedisTemplate<String, Object> redisTemplate) {
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.userService = userService;
        this.redisTemplate = redisTemplate;
    }

    // builds the Redis key for a given userId
    private String presenceKey(Long userId) {
        return PRESENCE_KEY_PREFIX + userId;
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

        if (status == UserStatus.ONLINE) {
            // store in Redis with TTL — auto-expires if server crashes
            redisTemplate.opsForValue().set(
                    presenceKey(userId),
                    presenceDTO,
                    PRESENCE_TTL_SECONDS,
                    TimeUnit.SECONDS
            );
        } else {
            // user is offline — remove the key immediately
            redisTemplate.delete(presenceKey(userId));
        }

        return presenceDTO;
    }

    public OnlineStatusDTO getUserPresence(Long userId) {
        // check Redis first — fast path
        Object cached = redisTemplate.opsForValue().get(presenceKey(userId));

        if (cached != null) {
            return (OnlineStatusDTO) cached;
        }

        // not in Redis — user is offline or key expired, fall back to DB
        User user = userService.getUserEntityById(userId);
        return new OnlineStatusDTO(
                user.getId(),
                user.getUsername(),
                user.getStatus(),
                user.getLastSeen()
        );
    }

    public void broadcastPresenceChange(OnlineStatusDTO presenceDTO) {
        messagingTemplate.convertAndSend("/topic/presence", presenceDTO);
    }

    @Transactional
    public void userConnected(Long userId) {
        OnlineStatusDTO presenceDTO = updateUserPresence(userId, UserStatus.ONLINE);
        broadcastPresenceChange(presenceDTO);
    }

    @Transactional
    public void userDisconnected(Long userId) {
        OnlineStatusDTO presenceDTO = updateUserPresence(userId, UserStatus.OFFLINE);
        broadcastPresenceChange(presenceDTO);
    }

    // scans Redis for all active presence keys and returns online users
    // replaces the old ConcurrentHashMap.values() call
    public List<OnlineStatusDTO> getAllOnlineUsers() {
        Set<String> keys = redisTemplate.keys(PRESENCE_KEY_PREFIX + "*");

        if (keys == null || keys.isEmpty()) {
            return List.of();
        }

        return keys.stream()
                .map(key -> redisTemplate.opsForValue().get(key))
                .filter(Objects::nonNull)
                .map(obj -> (OnlineStatusDTO) obj)
                .collect(Collectors.toList());
    }
}