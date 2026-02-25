package com.chatify.chat_backend.repository;

import com.chatify.chat_backend.entity.UserChatState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserChatStateRepository extends JpaRepository<UserChatState, Long> {

    Optional<UserChatState> findByUserIdAndChatRoomId(Long userId, Long chatRoomId);
}
