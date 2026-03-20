package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDTO {
    private Long id;
    private String username;
    private String email;
    private String bio;
    private String displayName;
    private String profilePicture;
    private UserStatus status;
    private LocalDateTime lastSeen;
    private LocalDateTime createdAt;
}
