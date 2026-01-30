package com.chatify.chat_backend.dto;

import java.util.List;

public class CreateChatRequest {
    private String name;
    private boolean isGroupChat;
    private List<Long> participantIds;

    // Getters and Setters
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public boolean isGroupChat() {
        return isGroupChat;
    }

    public void setIsGroupChat(boolean groupChat) {
        isGroupChat = groupChat;
    }

    public List<Long> getParticipantIds() {
        return participantIds;
    }
    public void setParticipantIds(List<Long> participantIds) { this.participantIds = participantIds; }
}