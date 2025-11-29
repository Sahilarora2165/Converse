package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoomDTO {
    private Long id;
    private String name;
    private boolean isGroupChat;
    private Set<UserDTO> participants;
    private UserDTO admin;
    private LocalDateTime createdAt;
    private Long unreadCount;
}
