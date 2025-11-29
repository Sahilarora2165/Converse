package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.OnlineStatusDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.UserStatus;
import com.chatify.chat_backend.repository.UserRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final UserService userService;
    
    private final Map<Long, OnlineStatusDTO> userPresence = new ConcurrentHashMap<>();

    public PresenceService(UserRepository userRepository,
                          SimpMessagingTemplate messagingTemplate,
                          UserService userService) {
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.userService = userService;
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
        userPresence.remove(userId);
    }

    public Map<Long, OnlineStatusDTO> getAllOnlineUsers() {
        return new ConcurrentHashMap<>(userPresence);
    }
}
