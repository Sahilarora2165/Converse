package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.UnreadCountDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.Message;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.entity.UserChatState;
import com.chatify.chat_backend.exception.BadRequestException;
import com.chatify.chat_backend.exception.ResourceNotFoundException;
import com.chatify.chat_backend.exception.UnauthorizedException;
import com.chatify.chat_backend.repository.ChatRoomRepository;
import com.chatify.chat_backend.repository.MessageRepository;
import com.chatify.chat_backend.repository.UserChatStateRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final MessageRepository messageRepository;
    private final UserService userService;
    private final UserChatStateRepository userChatStateRepository;

    @Lazy
    private final MessageService messageService;

    public ChatRoomService(ChatRoomRepository chatRoomRepository,
                           MessageRepository messageRepository,
                           UserService userService,
                           UserChatStateRepository userChatStateRepository,
                           @Lazy MessageService messageService) {
        this.chatRoomRepository = chatRoomRepository;
        this.messageRepository = messageRepository;
        this.userService = userService;
        this.userChatStateRepository = userChatStateRepository;
        this.messageService = messageService;
    }

    // ✅ FIXED - Was: 1 query (no JOIN FETCH) + 2N lazy loads + 3N per-room queries = 101 queries for 20 rooms
    // Now: 5 queries total regardless of room count
    @Transactional(readOnly = true)
    public List<ChatRoomDTO> getChatRoomsForUser(Long userId) {
        User user = userService.getUserEntityById(userId);

        // Query 1: Rooms + participants + admin all JOIN FETCHed — 0 lazy loads
        List<ChatRoom> rooms = chatRoomRepository.findByParticipantWithDetails(user);

        if (rooms.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> roomIds = rooms.stream()
                .map(ChatRoom::getId)
                .collect(Collectors.toList());

        // Query 2: All UserChatStates for this user across all rooms — 1 query
        // Converted to Map<roomId, UserChatState> for O(1) lookup per room
        Map<Long, UserChatState> chatStateMap = userChatStateRepository
                .findByUserIdAndChatRoomIdIn(userId, roomIds)
                .stream()
                .collect(Collectors.toMap(
                        ucs -> ucs.getChatRoom().getId(),
                        ucs -> ucs
                ));

        // Query 3: Last message per room — 1 query (subquery approach)
        // Converted to Map<roomId, Message> for O(1) lookup per room
        Map<Long, Message> lastMessageMap = messageRepository
                .findLastMessagesForRooms(roomIds)
                .stream()
                .collect(Collectors.toMap(
                        m -> m.getChatRoom().getId(),
                        m -> m
                ));

        // Query 4: Unread counts per room — 1 native query, handles both cases:
        // Case 1: user never read (ucs null) → count all messages not from user
        // Case 2: user has read state → count messages after lastReadMessageId
        Map<Long, Long> unreadCountMap = messageRepository
                .findUnreadCountsForRooms(userId, roomIds)
                .stream()
                .collect(Collectors.toMap(
                        UnreadCountDTO::getChatRoomId,
                        UnreadCountDTO::getUnreadCount
                ));

        // Map each room using pre-fetched maps — zero DB calls in this loop
        return rooms.stream()
                .map(room -> mapToDTO(room, user, chatStateMap, lastMessageMap, unreadCountMap))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Long> getChatRoomIdsForUser(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return chatRoomRepository.findChatRoomIdsByParticipantId(userId);
    }

    @Transactional
    public ChatRoomDTO createChatRoom(
            String name,
            boolean isGroupChat,
            List<Long> participantIds,
            Long currentUserId) {

        User currentUser = userService.getUserEntityById(currentUserId);

        if (!isGroupChat && participantIds.size() != 1) {
            throw new BadRequestException("Private chat must have exactly one other participant");
        }

        if (isGroupChat && participantIds.isEmpty()) {
            throw new BadRequestException("Group chat must have at least one participant");
        }

        if (!isGroupChat) {
            Long otherUserId = participantIds.get(0);
            Optional<ChatRoom> existing =
                    chatRoomRepository.findExistingPrivateChat(currentUserId, otherUserId);
            if (existing.isPresent()) {
                return mapToDTO(existing.get(), currentUser);
            }
        }

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setGroupChat(isGroupChat);

        if (isGroupChat) {
            chatRoom.setName(name);
            chatRoom.setAdmin(currentUser);
        } else {
            chatRoom.setName("Private Chat");
            chatRoom.setAdmin(null);
        }

        Set<User> participants = new HashSet<>();
        for (Long id : participantIds) {
            participants.add(userService.getUserEntityById(id));
        }
        participants.add(currentUser);
        chatRoom.setParticipants(participants);

        ChatRoom saved = chatRoomRepository.save(chatRoom);
        return mapToDTO(saved, currentUser);
    }

    @Transactional
    public ChatRoomDTO addParticipant(Long chatRoomId, Long userId, Long requesterId) {
        ChatRoom chatRoom = getChatRoomEntity(chatRoomId);

        if (!chatRoom.isGroupChat()) {
            throw new BadRequestException("Cannot add participants to a private chat");
        }

        if (chatRoom.getAdmin() == null || !chatRoom.getAdmin().getId().equals(requesterId)) {
            throw new UnauthorizedException("Only the admin can add participants");
        }

        User newParticipant = userService.getUserEntityById(userId);
        chatRoom.getParticipants().add(newParticipant);

        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);
        return mapToDTO(savedRoom, chatRoom.getAdmin());
    }

    @Transactional
    public ChatRoomDTO removeParticipant(Long chatRoomId, Long userId, Long requesterId) {
        ChatRoom chatRoom = getChatRoomEntity(chatRoomId);

        if (!chatRoom.isGroupChat()) {
            throw new BadRequestException("Cannot remove participants from a private chat");
        }

        if (chatRoom.getAdmin() == null || !chatRoom.getAdmin().getId().equals(requesterId)) {
            throw new UnauthorizedException("Only the admin can remove participants");
        }

        User participantToRemove = userService.getUserEntityById(userId);
        chatRoom.getParticipants().remove(participantToRemove);

        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);
        return mapToDTO(savedRoom, chatRoom.getAdmin());
    }

    @Transactional(readOnly = true)
    public ChatRoomDTO getChatRoomById(Long chatRoomId, Long userId) {
        User user = userService.getUserEntityById(userId);
        ChatRoom chatRoom = getChatRoomEntity(chatRoomId);

        if (!chatRoom.getParticipants().contains(user)) {
            throw new UnauthorizedException("User is not a participant of this chat room");
        }

        return mapToDTO(chatRoom, user);
    }

    @Transactional(readOnly = true)
    public ChatRoom getChatRoomEntity(Long chatRoomId) {
        return chatRoomRepository.findById(chatRoomId)
                .orElseThrow(() -> new ResourceNotFoundException("ChatRoom", chatRoomId));
    }

    public boolean isUserInChatRoom(Long chatRoomId, Long userId) {
        return chatRoomRepository.existsByIdAndParticipantId(chatRoomId, userId);
    }

    @Transactional
    public void markChatAsRead(Long chatRoomId, User user) {
        ChatRoom chatRoom = getChatRoomEntity(chatRoomId);

        Message lastMessage = messageRepository
                .findTopByChatRoomOrderByTimestampDesc(chatRoom)
                .orElse(null);

        UserChatState state = userChatStateRepository
                .findByUserIdAndChatRoomId(user.getId(), chatRoomId)
                .orElseGet(() -> {
                    UserChatState s = new UserChatState();
                    s.setUser(user);
                    s.setChatRoom(chatRoom);
                    return s;
                });

        if (lastMessage != null) {
            state.setLastReadMessage(lastMessage);
            state.setLastReadAt(Instant.now());
            userChatStateRepository.save(state);
            messageService.markAllMessagesAsRead(chatRoomId, user.getId());
        }
    }

    // ✅ BATCH version — used only inside getChatRoomsForUser
    // All data pre-fetched, zero DB calls here
    private ChatRoomDTO mapToDTO(
            ChatRoom chatRoom,
            User currentUser,
            Map<Long, UserChatState> chatStateMap,
            Map<Long, Message> lastMessageMap,
            Map<Long, Long> unreadCountMap) {

        Set<UserDTO> participantDTOs = chatRoom.getParticipants().stream()
                .map(userService::mapToDTO)
                .collect(Collectors.toSet());

        UserDTO adminDTO = chatRoom.getAdmin() != null
                ? userService.mapToDTO(chatRoom.getAdmin())
                : null;

        Long unreadCount = unreadCountMap.getOrDefault(chatRoom.getId(), 0L);

        Message lastMsg = lastMessageMap.get(chatRoom.getId());
        String lastMessageContent = lastMsg != null ? lastMsg.getContent() : null;
        LocalDateTime lastMessageTime = lastMsg != null ? lastMsg.getTimestamp() : null;
        Long lastMessageSenderId = lastMsg != null ? lastMsg.getSender().getId() : null;
        String lastMessageSenderName = lastMsg != null ? lastMsg.getSender().getUsername() : null;

        return new ChatRoomDTO(
                chatRoom.getId(),
                chatRoom.getName(),
                chatRoom.isGroupChat(),
                participantDTOs,
                adminDTO,
                chatRoom.getCreatedAt(),
                unreadCount,
                lastMessageContent,
                lastMessageTime,
                lastMessageSenderId,
                lastMessageSenderName
        );
    }

    // ✅ SINGLE-ROOM version — used by getChatRoomById, createChatRoom,
    // addParticipant, removeParticipant — unchanged behavior
    private ChatRoomDTO mapToDTO(ChatRoom chatRoom, User currentUser) {
        Set<UserDTO> participantDTOs = chatRoom.getParticipants().stream()
                .map(userService::mapToDTO)
                .collect(Collectors.toSet());

        UserDTO adminDTO = chatRoom.getAdmin() != null
                ? userService.mapToDTO(chatRoom.getAdmin())
                : null;

        Long unreadCount = calculateUnreadCount(chatRoom.getId(), currentUser.getId());

        Optional<Message> lastMessageOpt =
                messageRepository.findTopByChatRoomOrderByTimestampDesc(chatRoom);

        String lastMessageContent = null;
        LocalDateTime lastMessageTime = null;
        Long lastMessageSenderId = null;
        String lastMessageSenderName = null;

        if (lastMessageOpt.isPresent()) {
            Message lastMsg = lastMessageOpt.get();
            lastMessageContent = lastMsg.getContent();
            lastMessageTime = lastMsg.getTimestamp();
            lastMessageSenderId = lastMsg.getSender().getId();
            lastMessageSenderName = lastMsg.getSender().getUsername();
        }

        return new ChatRoomDTO(
                chatRoom.getId(),
                chatRoom.getName(),
                chatRoom.isGroupChat(),
                participantDTOs,
                adminDTO,
                chatRoom.getCreatedAt(),
                unreadCount,
                lastMessageContent,
                lastMessageTime,
                lastMessageSenderId,
                lastMessageSenderName
        );
    }

    // Used only by single-room mapToDTO above — unchanged logic
    private Long calculateUnreadCount(Long chatRoomId, Long userId) {
        Optional<UserChatState> stateOpt = userChatStateRepository
                .findByUserIdAndChatRoomId(userId, chatRoomId);

        if (stateOpt.isEmpty() || stateOpt.get().getLastReadMessage() == null) {
            return messageRepository.countByChatRoomIdAndSenderIdNot(chatRoomId, userId);
        }

        Long lastReadMessageId = stateOpt.get().getLastReadMessage().getId();
        return messageRepository.countByChatRoomIdAndIdGreaterThanAndSenderIdNot(
                chatRoomId, lastReadMessageId, userId);
    }
}