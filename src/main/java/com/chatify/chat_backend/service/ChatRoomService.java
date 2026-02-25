package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.CreateChatRequest;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final MessageRepository messageRepository;
    private final UserService userService;
    private final UserChatStateRepository userChatStateRepository;

    public ChatRoomService(ChatRoomRepository chatRoomRepository,
                           MessageRepository messageRepository,
                           UserService userService,
                           UserChatStateRepository userChatStateRepository) {
        this.chatRoomRepository = chatRoomRepository;
        this.messageRepository = messageRepository;
        this.userService = userService;
        this.userChatStateRepository = userChatStateRepository;
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
    public List<ChatRoomDTO> getChatRoomsForUser(Long userId) {
        User user = userService.getUserEntityById(userId);
        return chatRoomRepository.findByParticipant(user).stream()
                .map(room -> mapToDTO(room, user))
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
            Long currentUserId
    ) {
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
        ChatRoom chatRoom = getChatRoomEntity(chatRoomId);
        User user = userService.getUserEntityById(userId);
        return chatRoom.getParticipants().contains(user);
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
        }
    }

    private ChatRoomDTO mapToDTO(ChatRoom chatRoom, User currentUser) {
        Set<UserDTO> participantDTOs = chatRoom.getParticipants().stream()
                .map(userService::mapToDTO)
                .collect(Collectors.toSet());

        UserDTO adminDTO = chatRoom.getAdmin() != null ? userService.mapToDTO(chatRoom.getAdmin()) : null;

        Long unreadCount = messageRepository.countUnreadMessagesByChatRoomAndUser(chatRoom, currentUser);

        Optional<Message> lastMessageOpt = messageRepository.findTopByChatRoomOrderByTimestampDesc(chatRoom);

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
}