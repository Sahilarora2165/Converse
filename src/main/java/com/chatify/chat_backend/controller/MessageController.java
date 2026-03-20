package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.*;
import com.chatify.chat_backend.service.MessageService;
import com.chatify.chat_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;
    private final UserService userService;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageController(MessageService messageService,
                             UserService userService,
                             SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.userService = userService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    public ResponseEntity<MessageDTO> sendMessage(
            @Valid @RequestBody SendMessageDTO dto,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);

        MessageDTO savedMessage = messageService.sendMessage(dto, currentUser.getId());

        messagingTemplate.convertAndSend("/topic/chatroom/" + dto.getChatRoomId(), savedMessage);

        return ResponseEntity.status(HttpStatus.CREATED).body(savedMessage);
    }

    @GetMapping("/chatroom/{chatRoomId}")
    public ResponseEntity<List<MessageDTO>> getMessagesByChatRoom(
            @PathVariable Long chatRoomId,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(messageService.getMessagesByChatRoom(chatRoomId, currentUser.getId()));
    }

    @GetMapping("/chatroom/{chatRoomId}/paginated")
    public ResponseEntity<Page<MessageDTO>> getMessagesByChatRoomPaginated(
            @PathVariable Long chatRoomId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(
                messageService.getMessagesByChatRoomPaginated(chatRoomId, currentUser.getId(), page, size));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<MessageDTO> markMessageAsRead(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(messageService.markMessageAsRead(id, currentUser.getId()));
    }

    @PutMapping("/chatroom/{chatRoomId}/read-all")
    public ResponseEntity<Void> markAllMessagesAsRead(
            @PathVariable Long chatRoomId,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        messageService.markAllMessagesAsRead(chatRoomId, currentUser.getId());
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageDTO> editMessage(
            @PathVariable Long id,
            @Valid @RequestBody EditMessageDTO dto,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        MessageDTO edited = messageService.editMessage(id, currentUser.getId(), dto.getNewContent());

        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + edited.getChatRoomId() + "/edits", edited);

        return ResponseEntity.ok(edited);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageDTO> deleteMessage(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        MessageDTO deleted = messageService.softDeleteMessage(id, currentUser.getId());

        messagingTemplate.convertAndSend(
                "/topic/chatroom/" + deleted.getChatRoomId() + "/deletes", deleted);

        return ResponseEntity.ok(deleted);
    }

    @GetMapping("/search")
    public ResponseEntity<Page<MessageDTO>> searchMessages(
            @RequestParam Long chatRoomId,
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        return ResponseEntity.ok(
                messageService.searchMessages(chatRoomId, currentUser.getId(), query, page, size));
    }
}