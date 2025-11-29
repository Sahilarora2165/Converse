package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OnlineStatusDTO {
    private Long userId;
    private String username;
    private UserStatus status;
    private LocalDateTime lastSeen;
}
