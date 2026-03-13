package com.chatify.chat_backend.repository;

import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    @Query("""
        SELECT DISTINCT cr FROM ChatRoom cr
        LEFT JOIN FETCH cr.participants
        LEFT JOIN FETCH cr.admin
        WHERE :user MEMBER OF cr.participants
    """)
    List<ChatRoom> findByParticipantWithDetails(@Param("user") User user);

    // Kept as-is — still used in getChatRoomEntity and isUserInChatRoom
    @Query("SELECT cr FROM ChatRoom cr JOIN cr.participants p WHERE p = :user")
    List<ChatRoom> findByParticipant(@Param("user") User user);

    @Query("""
        SELECT c FROM ChatRoom c
        JOIN c.participants p
        WHERE c.isGroupChat = false
        AND p.id IN (:userId1, :userId2)
        GROUP BY c.id
        HAVING COUNT(DISTINCT p.id) = 2
    """)
    Optional<ChatRoom> findExistingPrivateChat(
            @Param("userId1") Long userId1,
            @Param("userId2") Long userId2
    );

    @Query("SELECT cr.id FROM ChatRoom cr JOIN cr.participants p WHERE p.id = :userId")
    List<Long> findChatRoomIdsByParticipantId(@Param("userId") Long userId);

    List<ChatRoom> findByIsGroupChatTrue();

    @Query("SELECT COUNT(u) > 0 FROM ChatRoom c JOIN c.participants u WHERE c.id = :chatRoomId AND u.id = :userId")
    boolean existsByIdAndParticipantId(@Param("chatRoomId") Long chatRoomId, @Param("userId") Long userId);

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.admin = :admin")
    List<ChatRoom> findByAdmin(@Param("admin") User admin);
}