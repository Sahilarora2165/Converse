package com.chatify.chat_backend.dto;

import lombok.Data;

@Data
public class MessageSeenAckDTO {
    private Long chatRoomId;
    private Long lastSeenMessageId;
}
