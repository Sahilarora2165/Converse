package com.chatify.chat_backend.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateChatRoomDTO {
    private String name;
    private boolean isGroupChat = false;

    @NotEmpty(message = "At least one participant is required")
    private Set<Long> participantIds;
}
