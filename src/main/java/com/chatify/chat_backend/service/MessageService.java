package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.MessageDTO;
import com.chatify.chat_backend.dto.MessageDeliveryUpdateDTO;
import com.chatify.chat_backend.dto.MessageSeenUpdateDTO;
import com.chatify.chat_backend.dto.SendMessageDTO;
import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.Message;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.UserChatState;
import com.chatify.chat_backend.entity.enums.MessageStatus;
import com.chatify.chat_backend.exception.BadRequestException;
import com.chatify.chat_backend.exception.ResourceNotFoundException;
import com.chatify.chat_backend.exception.UnauthorizedException;
import com.chatify.chat_backend.repository.ChatRoomRepository;
import com.chatify.chat_backend.repository.MessageRepository;
import com.chatify.chat_backend.repository.UserChatStateRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final UserService userService;
    private final UserChatStateRepository userChatStateRepository;
    private final ChatRoomService chatRoomService;

    public MessageService(MessageRepository messageRepository,
                          ChatRoomRepository chatRoomRepository,
                          UserService userService,
                          ChatRoomService chatRoomService,
                          UserChatStateRepository userChatStateRepository) {
        this.messageRepository = messageRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.userService = userService;
        this.chatRoomService = chatRoomService;
        this.userChatStateRepository = userChatStateRepository;
    }

    @Transactional
    public MessageDTO sendMessage(SendMessageDTO dto, Long senderId) {
        // must have either text content or a file attachment
        boolean hasContent = dto.getContent() != null && !dto.getContent().isBlank();
        boolean hasFile = dto.getFileUrl() != null && !dto.getFileUrl().isBlank();
        if (!hasContent && !hasFile) {
            throw new BadRequestException("Message must have content or a file attachment");
        }

        User sender = userService.getUserEntityById(senderId);
        ChatRoom chatRoom = chatRoomService.getChatRoomEntity(dto.getChatRoomId());

        if (!chatRoom.getParticipants().contains(sender)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        Message message = new Message();
        message.setContent(dto.getContent() != null ? dto.getContent() : "");
        message.setMessageType(dto.getMessageType());
        message.setFileUrl(dto.getFileUrl());
        message.setFileName(dto.getFileName());
        message.setSender(sender);
        message.setChatRoom(chatRoom);

        if (dto.getReplyToMessageId() != null) {
            Message replyTo = messageRepository.findById(dto.getReplyToMessageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Message", dto.getReplyToMessageId()));
            message.setReplyTo(replyTo);
        }

        message.setStatus(MessageStatus.SENT);

        Message savedMessage = messageRepository.save(message);
        return mapToDTO(savedMessage);
    }

    @Transactional(readOnly = true)
    public List<MessageDTO> getMessagesByChatRoom(Long chatRoomId, Long userId) {
        User user = userService.getUserEntityById(userId);

        // ✅ FIXED - Use repository instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        return messageRepository.findByChatRoomOrderByTimestampAsc(chatRoom).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Page<MessageDTO> getMessagesByChatRoomPaginated(Long chatRoomId, Long userId, int page, int size) {
        User user = userService.getUserEntityById(userId);

        // ✅ FIXED - Use repository instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        Pageable pageable = PageRequest.of(page, size);
        return messageRepository.findByChatRoomOrderByTimestampDesc(chatRoom, pageable)
                .map(this::mapToDTO);
    }

    @Transactional
    public MessageDTO markMessageAsRead(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", messageId));

        User user = userService.getUserEntityById(userId);
        ChatRoom chatRoom = message.getChatRoom();

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        message.getReadBy().add(user);
        Message savedMessage = messageRepository.save(message);
        return mapToDTO(savedMessage);
    }

    @Transactional
    public void markAllMessagesAsRead(Long chatRoomId, Long userId) {
        User user = userService.getUserEntityById(userId);

        // ✅ Use repository directly instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        // Fetch all unread for this user
        List<Message> unreadMessages = messageRepository.findUnreadMessagesByChatRoomAndUser(chatRoom, user);

        if (unreadMessages.isEmpty()) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Message lastReadMessage = null;

        for (Message message : unreadMessages) {
            if (!message.getSender().getId().equals(userId)) {
                message.getReadBy().add(user);
                message.setStatus(MessageStatus.SEEN);
                message.setSeenAt(now);
                lastReadMessage = message; // ✅ Track the last one
            }
        }

        messageRepository.saveAll(unreadMessages);

        // ✅ CRITICAL FIX - Update UserChatState.lastReadMessage
        if (lastReadMessage != null) {
            UserChatState state = userChatStateRepository
                    .findByUserIdAndChatRoomId(userId, chatRoomId)
                    .orElseGet(() -> {
                        UserChatState s = new UserChatState();
                        s.setUser(user);
                        s.setChatRoom(chatRoom);
                        return s;
                    });

            state.setLastReadMessage(lastReadMessage);
            state.setLastReadAt(Instant.now());
            userChatStateRepository.save(state);
        }
    }

    @Transactional
    public MessageDTO editMessage(Long messageId, Long userId, String newContent) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new UnauthorizedException("Only the sender can edit this message");
        }

        if (message.isDeleted()) {
            throw new BadRequestException("Cannot edit a deleted message");
        }

        message.setContent(newContent);
        message.setEdited(true);
        message.setEditedAt(LocalDateTime.now());

        Message saved = messageRepository.save(message);
        return mapToDTO(saved);
    }

    @Transactional
    public MessageDTO softDeleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new UnauthorizedException("Only the sender can delete this message");
        }

        message.setDeleted(true);
        message.setContent("");

        Message saved = messageRepository.save(message);
        return mapToDTO(saved);
    }

    @Transactional
    public void deleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new UnauthorizedException("Only the sender can delete this message");
        }

        messageRepository.delete(message);
    }

    @Transactional(readOnly = true)
    public Page<MessageDTO> searchMessages(Long chatRoomId, Long userId, String query, int page, int size) {
        User user = userService.getUserEntityById(userId);

        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        Pageable pageable = PageRequest.of(page, size);
        return messageRepository.searchMessages(chatRoomId, query, pageable)
                .map(this::mapToDTO);
    }

    @Transactional
    public MessageDeliveryUpdateDTO markMessagesAsDelivered(
            Long chatRoomId,
            Long recipientUserId,
            Long lastDeliveredMessageId) {
        User recipient = userService.getUserEntityById(recipientUserId);

        // ✅ FIXED - Use repository instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(recipient)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        List<Message> messagesToUpdate = messageRepository.findMessagesToDeliver(
                chatRoom,
                recipient,
                lastDeliveredMessageId);

        if (messagesToUpdate.isEmpty()) {
            return null;
        }

        LocalDateTime now = LocalDateTime.now();
        for (Message message : messagesToUpdate) {
            message.setStatus(MessageStatus.DELIVERED);
            message.setDeliveredAt(now);
        }

        messageRepository.saveAll(messagesToUpdate);

        return new MessageDeliveryUpdateDTO(
                chatRoomId,
                lastDeliveredMessageId);
    }

    @Transactional
    public MessageSeenUpdateDTO markMessagesAsSeen(
            Long chatRoomId,
            Long recipientUserId,
            Long lastSeenMessageId) {
        User recipient = userService.getUserEntityById(recipientUserId);

        // ✅ FIXED - Use repository instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));

        if (!chatRoom.getParticipants().contains(recipient)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        List<Message> messagesToUpdate = messageRepository.findMessagesToMarkSeen(
                chatRoom,
                recipient,
                lastSeenMessageId);

        if (messagesToUpdate.isEmpty()) {
            return null;
        }

        LocalDateTime now = LocalDateTime.now();
        for (Message message : messagesToUpdate) {
            if (message.getStatus() == MessageStatus.SENT) {
                message.setDeliveredAt(now);
            }
            message.setStatus(MessageStatus.SEEN);
            message.setSeenAt(now);
            message.getReadBy().add(recipient);
        }

        messageRepository.saveAll(messagesToUpdate);

        return new MessageSeenUpdateDTO(
                chatRoomId,
                lastSeenMessageId);
    }

    public MessageDTO mapToDTO(Message message) {
        MessageDTO dto = new MessageDTO();
        dto.setId(message.getId());
        dto.setContent(message.isDeleted() ? "This message was deleted" : message.getContent());
        dto.setMessageType(message.getMessageType());
        dto.setFileUrl(message.isDeleted() ? null : message.getFileUrl());
        dto.setFileName(message.isDeleted() ? null : message.getFileName());
        dto.setSenderId(message.getSender().getId());
        dto.setSenderUsername(message.getSender().getUsername());
        dto.setChatRoomId(message.getChatRoom().getId());
        dto.setTimestamp(message.getTimestamp());
        dto.setReadByUserIds(message.getReadBy().stream().map(User::getId).collect(Collectors.toSet()));
        dto.setStatus(message.getStatus());
        dto.setEdited(message.isEdited());
        dto.setEditedAt(message.getEditedAt());
        dto.setDeleted(message.isDeleted());

        if (message.getReplyTo() != null) {
            Message reply = message.getReplyTo();
            dto.setReplyToId(reply.getId());
            dto.setReplyToContent(reply.isDeleted() ? "This message was deleted" : reply.getContent());
            dto.setReplyToSenderName(reply.getSender().getUsername());
            dto.setReplyToMessageType(reply.getMessageType());
        }

        return dto;
    }
}