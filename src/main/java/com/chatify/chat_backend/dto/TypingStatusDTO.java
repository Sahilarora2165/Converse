package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TypingStatusDTO {
    private Long userId;
    private String username;
    private Long chatRoomId;
    private boolean isTyping;
}
