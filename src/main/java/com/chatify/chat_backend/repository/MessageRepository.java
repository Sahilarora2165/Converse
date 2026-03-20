package com.chatify.chat_backend.repository;

import com.chatify.chat_backend.entity.ChatRoom;
import com.chatify.chat_backend.entity.Message;
import com.chatify.chat_backend.entity.User;
import com.chatify.chat_backend.dto.UnreadCountDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    List<Message> findByChatRoomOrderByTimestampAsc(ChatRoom chatRoom);

    Page<Message> findByChatRoomOrderByTimestampDesc(ChatRoom chatRoom, Pageable pageable);

    List<Message> findBySender(User sender);

    @Query("SELECT m FROM Message m WHERE m.chatRoom = :chatRoom AND :user NOT MEMBER OF m.readBy")
    List<Message> findUnreadMessagesByChatRoomAndUser(
            @Param("chatRoom") ChatRoom chatRoom,
            @Param("user") User user);

    @Query("SELECT COUNT(m) FROM Message m WHERE m.chatRoom = :chatRoom AND :user NOT MEMBER OF m.readBy")
    Long countUnreadMessagesByChatRoomAndUser(
            @Param("chatRoom") ChatRoom chatRoom,
            @Param("user") User user);

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
            @Param("lastMessageId") Long lastMessageId);

    @Query("""
        SELECT m FROM Message m
        WHERE m.chatRoom = :chatRoom
          AND m.sender <> :recipient
          AND (m.status = com.chatify.chat_backend.entity.enums.MessageStatus.SENT
               OR m.status = com.chatify.chat_backend.entity.enums.MessageStatus.DELIVERED)
          AND m.id <= :lastMessageId
    """)
    List<Message> findMessagesToMarkSeen(
            @Param("chatRoom") ChatRoom chatRoom,
            @Param("recipient") User recipient,
            @Param("lastMessageId") Long lastMessageId);

    Optional<Message> findTopByChatRoomOrderByTimestampDesc(ChatRoom chatRoom);

    @Query("""
        SELECT COUNT(m) FROM Message m
        WHERE m.chatRoom.id = :chatRoomId
        AND m.sender.id != :userId
        AND m.id > :lastReadMessageId
    """)
    Long countUnreadMessagesByUserChatState(
            @Param("chatRoomId") Long chatRoomId,
            @Param("userId") Long userId,
            @Param("lastReadMessageId") Long lastReadMessageId);

    long countByChatRoomIdAndSenderIdNot(
            @Param("chatRoomId") Long chatRoomId,
            @Param("senderId") Long senderId);

    long countByChatRoomIdAndIdGreaterThanAndSenderIdNot(
            Long chatRoomId,
            Long lastReadMessageId,
            Long senderId);


    @Query("""
        SELECT m FROM Message m
        JOIN FETCH m.sender
        WHERE m.chatRoom.id IN :chatRoomIds
        AND m.timestamp = (
            SELECT MAX(m2.timestamp) FROM Message m2
            WHERE m2.chatRoom.id = m.chatRoom.id
        )
    """)
    List<Message> findLastMessagesForRooms(
            @Param("chatRoomIds") List<Long> chatRoomIds);


    @Query(value = """
        SELECT m.chat_room_id AS chatRoomId, COUNT(*) AS unreadCount
        FROM messages m
        LEFT JOIN user_chat_state ucs
            ON ucs.chat_room_id = m.chat_room_id
            AND ucs.user_id = :userId
        WHERE m.chat_room_id IN :chatRoomIds
        AND m.sender_id != :userId
        AND (ucs.last_read_message_id IS NULL OR m.id > ucs.last_read_message_id)
        GROUP BY m.chat_room_id
    """, nativeQuery = true)
    List<UnreadCountDTO> findUnreadCountsForRooms(
            @Param("userId") Long userId,
            @Param("chatRoomIds") List<Long> chatRoomIds);

    @Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND m.deleted = false AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.timestamp DESC")
    Page<Message> searchMessages(@Param("chatRoomId") Long chatRoomId, @Param("query") String query, Pageable pageable);
}