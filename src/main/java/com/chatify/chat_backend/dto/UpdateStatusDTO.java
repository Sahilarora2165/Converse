package com.chatify.chat_backend.dto;

import com.chatify.chat_backend.entity.enums.UserStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStatusDTO {
    @NotNull(message = "Status is required")
    private UserStatus status;
}
