package com.chatify.chat_backend.repository;

import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.Message;
import com.chatify.chat_backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByChatRoomOrderByTimestampAsc(ChatRoom chatRoom);

    Page<Message> findByChatRoomOrderByTimestampDesc(ChatRoom chatRoom, Pageable pageable);

    List<Message> findBySender(User sender);

    @Query("SELECT m FROM Message m WHERE m.chatRoom = :chatRoom AND :user NOT MEMBER OF m.readBy")
    List<Message> findUnreadMessagesByChatRoomAndUser(@Param("chatRoom") ChatRoom chatRoom, @Param("user") User user);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.chatRoom = :chatRoom AND :user NOT MEMBER OF m.readBy")
    Long countUnreadMessagesByChatRoomAndUser(@Param("chatRoom") ChatRoom chatRoom, @Param("user") User user);

    @Query("""
    SELECT m FROM Message m
    WHERE m.chatRoom = :chatRoom
      AND m.sender <> :recipient
      AND m.status = com.chatify.chat_backend.entity.enums.MessageStatus.SENT
      AND m.id <= :lastMessageId
""")
    List<Message> findMessagesToDeliver(
            @Param("chatRoom") ChatRoom chatRoom,
            @Param("recipient") User recipient,
            @Param("lastMessageId") Long lastMessageId
    );

    @Query("""
    SELECT m FROM Message m
    WHERE m.chatRoom = :chatRoom
      AND m.sender <> :recipient
      AND m.status = com.chatify.chat_backend.entity.enums.MessageStatus.DELIVERED
      AND m.id <= :lastMessageId
""")
    List<Message> findMessagesToMarkSeen(
            @Param("chatRoom") ChatRoom chatRoom,
            @Param("recipient") User recipient,
            @Param("lastMessageId") Long lastMessageId
    );


}
