package com.chatify.chat_backend.service;

import com.chatify.chat_backend.dto.ChatRoomDTO;
import com.chatify.chat_backend.dto.CreateChatRoomDTO;
import com.chatify.chat_backend.dto.UserDTO;
import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.exception.BadRequestException;
import com.chatify.chat_backend.exception.ResourceNotFoundException;
import com.chatify.chat_backend.exception.UnauthorizedException;
import com.chatify.chat_backend.repository.ChatRoomRepository;
import com.chatify.chat_backend.repository.MessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public ChatRoomService(ChatRoomRepository chatRoomRepository,
                          MessageRepository messageRepository,
                          UserService userService) {
        this.chatRoomRepository = chatRoomRepository;
        this.messageRepository = messageRepository;
        this.userService = userService;
    }

    @Transactional
    public ChatRoomDTO createPrivateChat(Long userId1, Long userId2) {
        User user1 = userService.getUserEntityById(userId1);
        User user2 = userService.getUserEntityById(userId2);

        Optional<ChatRoom> existingChat = chatRoomRepository.findPrivateChatBetweenUsers(user1, user2);
        if (existingChat.isPresent()) {
            return mapToDTO(existingChat.get(), user1);
        }

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setGroupChat(false);
        chatRoom.setParticipants(new HashSet<>(Set.of(user1, user2)));
        
        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);
        return mapToDTO(savedRoom, user1);
    }

    @Transactional
    public ChatRoomDTO createGroupChat(CreateChatRoomDTO dto, Long adminId) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new BadRequestException("Group chat name is required");
        }

        User admin = userService.getUserEntityById(adminId);
        
        Set<User> participants = new HashSet<>();
        participants.add(admin);
        
        for (Long participantId : dto.getParticipantIds()) {
            User participant = userService.getUserEntityById(participantId);
            participants.add(participant);
        }

        ChatRoom chatRoom = new ChatRoom();
        chatRoom.setName(dto.getName());
        chatRoom.setGroupChat(true);
        chatRoom.setParticipants(participants);
        chatRoom.setAdmin(admin);

        ChatRoom savedRoom = chatRoomRepository.save(chatRoom);
        return mapToDTO(savedRoom, admin);
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

    private ChatRoomDTO mapToDTO(ChatRoom chatRoom, User currentUser) {
        Set<UserDTO> participantDTOs = chatRoom.getParticipants().stream()
                .map(userService::mapToDTO)
                .collect(Collectors.toSet());

        UserDTO adminDTO = chatRoom.getAdmin() != null ? userService.mapToDTO(chatRoom.getAdmin()) : null;
        
        Long unreadCount = messageRepository.countUnreadMessagesByChatRoomAndUser(chatRoom, currentUser);

        return new ChatRoomDTO(
                chatRoom.getId(),
                chatRoom.getName(),
                chatRoom.isGroupChat(),
                participantDTOs,
                adminDTO,
                chatRoom.getCreatedAt(),
                unreadCount
        );
    }
}
