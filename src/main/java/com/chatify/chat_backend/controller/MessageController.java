package com.chatify.chat_backend.controller;

import com.chatify.chat_backend.dto.*;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.enums.MessageType;
import com.chatify.chat_backend.service.FileStorageService;
import com.chatify.chat_backend.service.MessageService;
import com.chatify.chat_backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;
import java.util.List;


@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;
    private final UserService userService;
    private final FileStorageService fileStorageService;
    private final SimpMessagingTemplate messagingTemplate; // <--- NEW FIELD

    // Updated Constructor
    public MessageController(MessageService messageService,
                             UserService userService,
                             FileStorageService fileStorageService,
                             SimpMessagingTemplate messagingTemplate) { // <--- INJECT HERE
        this.messageService = messageService;
        this.userService = userService;
        this.fileStorageService = fileStorageService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    public ResponseEntity<MessageDTO> sendMessage(
            @Valid @RequestBody SendMessageDTO dto,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);

        // 1. Save to DB
        MessageDTO savedMessage = messageService.sendMessage(dto, currentUser.getId());

        // 2. BROADCAST to WebSocket Subscribers! (The Missing Link)
        // This pushes the message to everyone listening to /topic/chatroom/{id}
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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable Long id,
            Authentication authentication) {
        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);
        messageService.deleteMessage(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/upload")
    public ResponseEntity<FileUploadResponseDTO> uploadFile(
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        FileUploadResponseDTO response = fileStorageService.uploadFile(file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/with-file")
    public ResponseEntity<MessageDTO> sendMessageWithFile(
            @RequestParam("chatRoomId") Long chatRoomId,
            @RequestParam("content") String content,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {

        String email = authentication.getName();
        UserDTO currentUser = userService.getUserByEmail(email);

        // 1. Upload File
        FileUploadResponseDTO uploadResponse = fileStorageService.uploadFile(file);

        // 2. Prepare DTO
        SendMessageDTO dto = new SendMessageDTO();
        dto.setChatRoomId(chatRoomId);
        dto.setContent(content);
        dto.setMessageType(isImage(file.getContentType()) ? MessageType.IMAGE : MessageType.FILE);
        dto.setFileUrl(uploadResponse.getFileUrl());
        dto.setFileName(uploadResponse.getFileName());

        // 3. Save to DB (Capture the result!)
        MessageDTO savedMessage = messageService.sendMessage(dto, currentUser.getId());

        // 4. BROADCAST to WebSocket (The Critical Fix)
        messagingTemplate.convertAndSend("/topic/chatroom/" + chatRoomId, savedMessage);

        // 5. Return response
        return ResponseEntity.status(HttpStatus.CREATED).body(savedMessage);
    }

    private boolean isImage(String contentType) {
        return contentType != null && contentType.startsWith("image/");
    }
}
