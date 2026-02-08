package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class MessageSeenUpdateDTO {
    private Long chatRoomId;
    private Long lastSeenMessageId;
}
