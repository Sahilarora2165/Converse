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

    @Query("SELECT cr FROM ChatRoom cr JOIN cr.participants p1 JOIN cr.participants p2 " +
           "WHERE p1 = :user1 AND p2 = :user2 AND cr.isGroupChat = false")
    Optional<ChatRoom> findPrivateChatBetweenUsers(@Param("user1") User user1, @Param("user2") User user2);

    List<ChatRoom> findByIsGroupChatTrue();

    @Query("SELECT cr FROM ChatRoom cr WHERE cr.admin = :admin")
    List<ChatRoom> findByAdmin(@Param("admin") User admin);
}
