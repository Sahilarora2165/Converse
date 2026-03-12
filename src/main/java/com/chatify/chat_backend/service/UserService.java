package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.UserStatus;
import com.chatify.chat_backend.exception.ResourceNotFoundException;
import com.chatify.chat_backend.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Boolean existsByEmail(String email) {
        return userRepository.findByEmail(email).isPresent();
    }

    // cached by id — TTL 5 min as configured in RedisConfig
    // key in Redis: "users::42"
    @Cacheable(value = "users", key = "#id")
    @Transactional(readOnly = true)
    public UserDTO getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
        return mapToDTO(user);
    }

    // cached by email — separate cache to allow lookup by both id and email
    // key in Redis: "users-by-email::john@example.com"
    @Cacheable(value = "users-by-email", key = "#email")
    @Transactional(readOnly = true)
    public UserDTO getUserByEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return mapToDTO(user);
    }

    // never cache — returns JPA entity with lazy collections
    // caching entities causes detached session issues
    @Transactional(readOnly = true)
    public User getUserEntityByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
    }

    // never cache — same reason as getUserEntityByEmail
    @Transactional(readOnly = true)
    public User getUserEntityById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @Transactional(readOnly = true)
    public List<UserDTO> getAllUsers() {
        return userRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<UserDTO> searchUsers(String query) {
        return userRepository.searchUsers(query).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    // evict both caches on status update — stale status in cache is worse than a cache miss
    @Caching(evict = {
            @CacheEvict(value = "users", key = "#userId"),
            @CacheEvict(value = "users-by-email", allEntries = true)
    })
    @Transactional
    public UserDTO updateUserStatus(Long userId, UserStatus status) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        user.setStatus(status);
        if (status == UserStatus.OFFLINE) {
            user.setLastSeen(LocalDateTime.now());
        }
        User savedUser = userRepository.save(user);
        return mapToDTO(savedUser);
    }

    // evict both caches — lastSeen changed, cached DTO is now stale
    @Caching(evict = {
            @CacheEvict(value = "users", key = "#userId"),
            @CacheEvict(value = "users-by-email", allEntries = true)
    })
    @Transactional
    public void updateLastSeen(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        user.setLastSeen(LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public List<UserDTO> getOnlineUsers() {
        return userRepository.findByStatus(UserStatus.ONLINE).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    public UserDTO mapToDTO(User user) {
        return new UserDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getProfilePicture(),
                user.getStatus(),
                user.getLastSeen(),
                user.getCreatedAt()
        );
    }
}