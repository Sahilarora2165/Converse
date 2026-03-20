package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.dto.UserProfileDTO;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.exception.ResourceNotFoundException;
import com.chatify.chat_backend.repository.UserRepository;
import com.chatify.chat_backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserProfileController {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserProfileController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
        this.userRepository = userRepository;
    }

    @GetMapping("/{userId}/profile")
    public ResponseEntity<UserProfileDTO> getUserProfile(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return ResponseEntity.ok(mapToProfileDTO(user));
    }

    @GetMapping("/me/profile")
    public ResponseEntity<UserProfileDTO> getOwnProfile(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));
        return ResponseEntity.ok(mapToProfileDTO(user));
    }

    @PutMapping("/me/profile")
    public ResponseEntity<UserProfileDTO> updateOwnProfile(
            @RequestBody UserProfileDTO profileDTO,
            Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User", "email", email));

        if (profileDTO.getBio() != null) {
            user.setBio(profileDTO.getBio());
        }
        if (profileDTO.getDisplayName() != null) {
            user.setDisplayName(profileDTO.getDisplayName());
        }

        User saved = userRepository.save(user);
        return ResponseEntity.ok(mapToProfileDTO(saved));
    }

    private UserProfileDTO mapToProfileDTO(User user) {
        return new UserProfileDTO(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getBio(),
                user.getDisplayName(),
                user.getProfilePicture(),
                user.getStatus(),
                user.getLastSeen(),
                user.getCreatedAt()
        );
    }
}
