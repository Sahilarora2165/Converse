package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.CreateChatRequest;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.service.ChatRoomService;
import com.chatify.chat_backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/chatrooms")
public class ChatRoomController {

    private final ChatRoomService chatRoomService;
    private final UserService userService;

    public ChatRoomController(ChatRoomService chatRoomService, UserService userService) {
        this.chatRoomService = chatRoomService;
        this.userService = userService;
    }

    @PostMapping
    public ResponseEntity<ChatRoomDTO> createChatRoom(
            @RequestBody CreateChatRequest request,
            Authentication authentication) {

        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);

        ChatRoomDTO chatRoom = chatRoomService.createChatRoom(
                request.getName(),
                request.isGroupChat(),
                request.getParticipantIds(),
                currentUser.getId()
        );

        return ResponseEntity.ok(chatRoom);
    }

    @GetMapping
    public ResponseEntity<List<ChatRoomDTO>> getChatRoomsForUser(Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(chatRoomService.getChatRoomsForUser(currentUser.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ChatRoomDTO> getChatRoomById(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(chatRoomService.getChatRoomById(id, currentUser.getId()));
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam("query") String query) {
        // TODO: Move filtering to database query (UserRepository) for production scale
        // Current approach loads all users into memory — acceptable for MVP
        List<UserDTO> allUsers = userService.getAllUsers();

        List<UserDTO> filteredUsers = allUsers.stream()
                .filter(user ->
                        user.getUsername().toLowerCase().contains(query.toLowerCase()) ||
                                user.getEmail().toLowerCase().contains(query.toLowerCase()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(filteredUsers);
    }

    @PostMapping("/{id}/participants")
    public ResponseEntity<ChatRoomDTO> addParticipant(
            @PathVariable Long id,
            @RequestBody Map<String, Long> request,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        Long userId = request.get("userId");

        if (userId == null) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(chatRoomService.addParticipant(id, userId, currentUser.getId()));
    }

    @DeleteMapping("/{id}/participants/{userId}")
    public ResponseEntity<ChatRoomDTO> removeParticipant(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(chatRoomService.removeParticipant(id, userId, currentUser.getId()));
    }
}