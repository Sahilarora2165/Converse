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
    // ✅ CHANGED - Use repository instead of service (breaks circular dependency)
    private final ChatRoomRepository chatRoomRepository;
    private final UserService userService;
    // ✅ ADDED - For updating UserChatState
    private final UserChatStateRepository userChatStateRepository;

    public MessageService(MessageRepository messageRepository,
                          ChatRoomRepository chatRoomRepository,
                          UserService userService,
                          UserChatStateRepository userChatStateRepository) {
        this.messageRepository = messageRepository;
        this.chatRoomRepository = chatRoomRepository;
        this.userService = userService;
        this.userChatStateRepository = userChatStateRepository;
    }

    @Transactional
    public MessageDTO sendMessage(SendMessageDTO dto, Long senderId) {
        User sender = userService.getUserEntityById(senderId);

        // ✅ FIXED - Use repository instead of chatRoomService
        ChatRoom chatRoom = chatRoomRepository.findById(dto.getChatRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", dto.getChatRoomId()));

        if (!chatRoom.getParticipants().contains(sender)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        Message message = new Message();
        message.setContent(dto.getContent());
        message.setMessageType(dto.getMessageType());
        message.setFileUrl(dto.getFileUrl());
        message.setFileName(dto.getFileName());
        message.setSender(sender);
        message.setChatRoom(chatRoom);

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
    public void deleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResourceNotFoundException("Message", messageId));

        if (!message.getSender().getId().equals(userId)) {
            throw new UnauthorizedException("Only the sender can delete this message");
        }

        messageRepository.delete(message);
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
        return new MessageDTO(
                message.getId(),
                message.getContent(),
                message.getMessageType(),
                message.getFileUrl(),
                message.getFileName(),
                message.getSender().getId(),
                message.getSender().getUsername(),
                message.getChatRoom().getId(),
                message.getTimestamp(),
                message.getReadBy().stream().map(User::getId).collect(Collectors.toSet()),
                message.getStatus()
        );
    }
}