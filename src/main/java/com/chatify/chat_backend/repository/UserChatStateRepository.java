package com.chatify.chat_backend.repository;

import com.chatify.chat_backend.entity.UserChatState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserChatStateRepository extends JpaRepository<UserChatState, Long> {

    Optional<UserChatState> findByUserIdAndChatRoomId(Long userId, Long chatRoomId);

    @Query("""
        SELECT ucs FROM UserChatState ucs
        LEFT JOIN FETCH ucs.lastReadMessage
        WHERE ucs.user.id = :userId
        AND ucs.chatRoom.id IN :chatRoomIds
    """)
    List<UserChatState> findByUserIdAndChatRoomIdIn(
            @Param("userId") Long userId,
            @Param("chatRoomIds") List<Long> chatRoomIds
    );
}