package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.OnlineStatusDTO;
import com.chatify.chat_backend.dto.UpdateStatusDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.service.PresenceService;
import com.chatify.chat_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PresenceService presenceService;

    public UserController(UserService userService, PresenceService presenceService) {
        this.userService = userService;
        this.presenceService = presenceService;
    }

    @GetMapping
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(userService.getUserByEmail(email));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam String query) {
        return ResponseEntity.ok(userService.searchUsers(query));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<UserDTO> updateUserStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusDTO statusDTO,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        
        if (!currentUser.getId().equals(id)) {
            return ResponseEntity.status(403).build();
        }
        
        return ResponseEntity.ok(userService.updateUserStatus(id, statusDTO.getStatus()));
    }

    @GetMapping("/{id}/presence")
    public ResponseEntity<OnlineStatusDTO> getUserPresence(@PathVariable Long id) {
        return ResponseEntity.ok(presenceService.getUserPresence(id));
    }

    @GetMapping("/online")
    public ResponseEntity<List<UserDTO>> getOnlineUsers() {
        return ResponseEntity.ok(userService.getOnlineUsers());
    }
}
