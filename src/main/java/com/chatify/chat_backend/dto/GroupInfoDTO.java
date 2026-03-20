package com.chatify.chat_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupInfoDTO {
    private Long id;
    private String name;
    private UserDTO admin;
    private Set<UserDTO> participants;
    private LocalDateTime createdAt;
}
