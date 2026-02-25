package com.chatify.chat_backend.dto;

import lombok.Data;

@Data
public class MessageDeliveredAckDTO {
    private Long chatRoomId;
    private Long lastDeliveredMessageId;
}
