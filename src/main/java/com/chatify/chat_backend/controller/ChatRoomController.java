package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.CreateChatRequest;
import com.chatify.chat_backend.dto.GroupInfoDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.service.ChatRoomService;
import com.chatify.chat_backend.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    private final SimpMessagingTemplate messagingTemplate;

    public ChatRoomController(ChatRoomService chatRoomService, UserService userService,
                              SimpMessagingTemplate messagingTemplate) {
        this.chatRoomService = chatRoomService;
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
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

    @GetMapping("/{id}/info")
    public ResponseEntity<GroupInfoDTO> getGroupInfo(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        ChatRoomDTO room = chatRoomService.getChatRoomById(id, currentUser.getId());
        GroupInfoDTO info = new GroupInfoDTO(
                room.getId(), room.getName(), room.getAdmin(),
                room.getParticipants(), room.getCreatedAt());
        return ResponseEntity.ok(info);
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam("query") String query) {
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

        ChatRoomDTO updated = chatRoomService.addParticipant(id, userId, currentUser.getId());
        messagingTemplate.convertAndSend("/topic/chatroom/" + id + "/updates", updated);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}/participants/{userId}")
    public ResponseEntity<ChatRoomDTO> removeParticipant(
            @PathVariable Long id,
            @PathVariable Long userId,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        ChatRoomDTO updated = chatRoomService.removeParticipant(id, userId, currentUser.getId());
        messagingTemplate.convertAndSend("/topic/chatroom/" + id + "/updates", updated);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/name")
    public ResponseEntity<ChatRoomDTO> updateGroupName(
            @PathVariable Long id,
            @RequestBody Map<String, String> request,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        String newName = request.get("name");
        ChatRoomDTO updated = chatRoomService.updateGroupName(id, currentUser.getId(), newName);
        messagingTemplate.convertAndSend("/topic/chatroom/" + id + "/updates", updated);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveGroup(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        chatRoomService.leaveGroup(id, currentUser.getId());
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/transfer-admin/{newAdminId}")
    public ResponseEntity<ChatRoomDTO> transferAdmin(
            @PathVariable Long id,
            @PathVariable Long newAdminId,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        ChatRoomDTO updated = chatRoomService.transferAdmin(id, currentUser.getId(), newAdminId);
        messagingTemplate.convertAndSend("/topic/chatroom/" + id + "/updates", updated);
        return ResponseEntity.ok(updated);
    }
}