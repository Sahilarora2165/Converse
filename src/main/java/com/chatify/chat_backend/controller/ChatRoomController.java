package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.CreateChatRoomDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.service.ChatRoomService;
import com.chatify.chat_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
            @Valid @RequestBody CreateChatRoomDTO dto,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);

        ChatRoomDTO chatRoom;
        if (dto.isGroupChat()) {
            chatRoom = chatRoomService.createGroupChat(dto, currentUser.getId());
        } else {
            if (dto.getParticipantIds() == null || dto.getParticipantIds().isEmpty()) {
                return ResponseEntity.badRequest().build();
            }
            Long otherUserId = dto.getParticipantIds().iterator().next();
            chatRoom = chatRoomService.createPrivateChat(currentUser.getId(), otherUserId);
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(chatRoom);
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
