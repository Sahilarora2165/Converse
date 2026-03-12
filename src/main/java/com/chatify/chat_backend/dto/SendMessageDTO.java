package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.MessageType;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageDTO {
    @NotNull(message = "Chat room ID is required")
    private Long chatRoomId;

    private String content;

    private MessageType messageType = MessageType.TEXT;
    private String fileUrl;
    private String fileName;
}