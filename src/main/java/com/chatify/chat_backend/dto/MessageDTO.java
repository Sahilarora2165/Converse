package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.MessageStatus;
import com.chatify.chat_backend.entity.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MessageDTO {

    private Long id;
    private String content;
    private MessageType messageType;
    private String fileUrl;
    private String fileName;

    private Long senderId;
    private String senderUsername;
    private Long chatRoomId;

    private LocalDateTime timestamp;

    private Set<Long> readByUserIds;

    private MessageStatus status;
}
