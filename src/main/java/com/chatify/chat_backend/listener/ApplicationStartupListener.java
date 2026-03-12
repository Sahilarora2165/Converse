package com.chatify.chat_backend.listener;

import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.UserStatus;
import com.chatify.chat_backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Component
public class ApplicationStartupListener {

    private static final Logger log = LoggerFactory.getLogger(ApplicationStartupListener.class);

    private final UserRepository userRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    public ApplicationStartupListener(UserRepository userRepository,
                                      RedisTemplate<String, Object> redisTemplate) {
        this.userRepository = userRepository;
        this.redisTemplate = redisTemplate;
    }

    // runs once after Spring context is fully loaded and app is ready
    // ApplicationReadyEvent fires after everything is wired — safe to use repos and Redis here
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void resetStalePresenceOnStartup() {
        log.info("Checking for stale ONLINE users from previous session...");

        // find all users still marked ONLINE in DB from before the restart
        List<User> staleOnlineUsers = userRepository.findByStatus(UserStatus.ONLINE);

        if (staleOnlineUsers.isEmpty()) {
            log.info("No stale ONLINE users found.");
        } else {
            log.warn("{} stale ONLINE user(s) found — resetting to OFFLINE", staleOnlineUsers.size());

            for (User user : staleOnlineUsers) {
                user.setStatus(UserStatus.OFFLINE);
                user.setLastSeen(LocalDateTime.now());
            }

            userRepository.saveAll(staleOnlineUsers);
            log.info("Reset {} user(s) to OFFLINE in DB", staleOnlineUsers.size());
        }

        // clear all leftover presence keys from Redis
        // covers the case where Redis persisted keys from before restart
        Set<String> leftoverKeys = redisTemplate.keys("presence:*");

        if (leftoverKeys != null && !leftoverKeys.isEmpty()) {
            redisTemplate.delete(leftoverKeys);
            log.info("Cleared {} leftover presence key(s) from Redis", leftoverKeys.size());
        }

        log.info("Presence reset complete — app is ready.");
    }
}