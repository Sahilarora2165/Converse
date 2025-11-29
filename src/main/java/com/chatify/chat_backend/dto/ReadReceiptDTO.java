package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReadReceiptDTO {
    private Long messageId;
    private Long userId;
    private String username;
    private Long chatRoomId;
    private LocalDateTime readAt;
}
