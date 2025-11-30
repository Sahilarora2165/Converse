package com.chatify.chat_backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
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
    
    @JsonProperty("isTyping")
    private boolean isTyping;
}
