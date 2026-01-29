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
            Long userId1,
            Long userId2
    );


    List<ChatRoom> findByIsGroupChatTrue();

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.admin = :admin")
    List<ChatRoom> findByAdmin(@Param("admin") User admin);
}
