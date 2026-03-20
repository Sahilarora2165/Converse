# Chat Features Implementation Plan

## Overview
Build 5 features in order of priority, starting with backend changes then frontend integration.

---

## Feature 1: Message Edit & Delete

### Backend Changes

**1.1 Update Message Entity** (`src/main/java/com/chatify/chat_backend/entity/Message.java`)
- Add `edited` boolean field (default false)
- Add `editedAt` LocalDateTime field
- Add `deleted` boolean field (soft delete, default false)
- Add `replyTo` ManyToOne relationship (self-referencing, nullable)

**1.2 Create DTOs**
- `EditMessageDTO.java` - messageId, newContent
- `MessageEditUpdateDTO.java` - for WebSocket broadcast

**1.3 Add MessageService Methods**
- `editMessage(Long messageId, Long userId, String newContent)` - edit and broadcast
- `softDeleteMessage(Long messageId, Long userId)` - mark as deleted

**1.4 Add REST Endpoints** (`MessageController.java`)
- `PUT /api/messages/{messageId}` - edit message
- `DELETE /api/messages/{messageId}` - soft delete message

**1.5 Add WebSocket Handlers** (`ChatWebSocketController.java`)
- `@MessageMapping("/chat.edit")` - real-time edit broadcast
- `@MessageMapping("/chat.delete")` - real-time delete broadcast
- Broadcast to `/topic/chatroom/{roomId}/edits` and `/topic/chatroom/{roomId}/deletes`

### Frontend Changes

**1.6 Update MessageDTO handling** (`chatify-frontend/src/services/api.js`)
- Add `editMessage(messageId, content)` API function
- Add `deleteMessage(messageId)` API function

**1.7 Update WebSocketContext** (`chatify-frontend/src/context/WebSocketContext.jsx`)
- Add `subscribeToEdits(roomId, callback)`
- Add `subscribeToDeletes(roomId, callback)`
- Add `sendEdit(roomId, messageId, content)`
- Add `sendDelete(roomId, messageId)`

**1.8 Update MessageItem** (`chatify-frontend/src/components/Chat/MessageItem.jsx`)
- Add hover menu with Edit/Delete options (only for own messages)
- Add "edited" indicator with timestamp
- Add "This message was deleted" placeholder for deleted messages
- Add inline edit mode with save/cancel

---

## Feature 2: Reply to Message

### Backend Changes

**2.1 Update Message Entity** (already done in 1.1)
- `replyTo` field is already added

**2.2 Update MessageDTO** (`MessageDTO.java`)
- Add `replyToId`, `replyToContent`, `replyToSenderName`, `replyToMessageType`

**2.3 Update SendMessageDTO** (`SendMessageDTO.java`)
- Add `replyToMessageId` field (optional)

**2.4 Update ChatMessageEvent** (`ChatMessageEvent.java`)
- Add `replyToMessageId` field

**2.5 Update MessageService.mapToDTO()**
- Include reply message details in DTO

### Frontend Changes

**2.6 Update Chat.jsx**
- Add `replyingTo` state
- Add reply preview bar above input when replying
- Pass `onReply` to MessageItem

**2.7 Update MessageItem**
- Add reply button in hover menu
- Display quoted/replied message at top of bubble
- Click on quoted message scrolls to original

**2.8 Update WebSocketContext**
- Update `sendMessage` to accept `replyToMessageId`

---

## Feature 3: User Profiles

### Backend Changes

**3.1 Update User Entity** (`src/main/java/com/chatify/chat_backend/entity/User.java`)
- Add `bio` String field (max 500 chars)
- Add `displayName` String field (optional, for custom display name)

**3.2 Create DTOs**
- `UserProfileDTO.java` - id, username, email, bio, displayName, profilePicture, status, lastSeen

**3.3 Create UserProfileController** (`UserProfileController.java`)
- `GET /api/users/{userId}/profile` - get public profile
- `GET /api/users/me/profile` - get own profile
- `PUT /api/users/me/profile` - update own profile

**3.4 Update UserService**
- Add `updateProfile(Long userId, UserProfileDTO dto)` method

### Frontend Changes

**3.5 Create Profile Components**
- `ProfileModal.jsx` - view/edit own profile
- `UserProfileModal.jsx` - view other user's profile

**3.6 Update ChatSidebar**
- Add profile button in header

**3.7 Update Chat.jsx**
- Click on user avatar/name opens their profile

**3.8 Update api.js**
- Add profile API functions

---

## Feature 4: Search Messages

### Backend Changes

**4.1 Update MessageRepository**
- Add `@Query` for full-text search:
```java
@Query("SELECT m FROM Message m WHERE m.chatRoom.id = :chatRoomId AND LOWER(m.content) LIKE LOWER(CONCAT('%', :query, '%')) ORDER BY m.timestamp DESC")
Page<Message> searchMessages(@Param("chatRoomId") Long chatRoomId, @Param("query") String query, Pageable pageable);
```

**4.2 Add MessageController Endpoint**
- `GET /api/messages/search?chatRoomId={id}&query={query}&page={page}&size={size}`

### Frontend Changes

**4.3 Create SearchModal Component**
- `SearchModal.jsx` - search input, results list
- Click on result scrolls to message in chat

**4.4 Update Chat.jsx**
- Add search button in header
- Opens search modal

---

## Feature 5: Group Chat Management

### Backend Changes

**5.1 Create GroupInfoDTO**
- `GroupInfoDTO.java` - id, name, admin, participants, createdAt

**5.2 Add ChatRoomController Endpoints**
- `GET /api/chatrooms/{id}/info` - get detailed group info
- `PUT /api/chatrooms/{id}/name` - admin only, change group name
- `DELETE /api/chatrooms/{id}/participants/{userId}` - admin removes user
- `POST /api/chatrooms/{id}/leave` - user exits group
- `POST /api/chatrooms/{id}/transfer-admin/{newAdminId}` - admin transfers role

**5.3 Update ChatRoomService**
- Add `updateGroupName(Long roomId, Long requesterId, String newName)`
- Add `leaveGroup(Long roomId, Long userId)`
- Add `transferAdmin(Long roomId, Long currentAdminId, Long newAdminId)`

**5.4 Add WebSocket Broadcasts**
- Broadcast group updates to `/topic/chatroom/{roomId}/updates`

### Frontend Changes

**5.5 Create GroupInfoModal Component**
- `GroupInfoModal.jsx` - displays:
  - Group name (editable by admin)
  - Participant list with roles
  - Admin controls (remove, transfer admin)
  - Leave group button

**5.6 Update Chat.jsx**
- Add group info button in header (only for group chats)
- Handle group update events via WebSocket

**5.7 Update ChatSidebar**
- Show admin badge for group chats

---

## Implementation Order

1. **Phase 1: Message Edit/Delete** (Backend + Frontend)
2. **Phase 2: Reply to Message** (Backend + Frontend)
3. **Phase 3: User Profiles** (Backend + Frontend)
4. **Phase 4: Search Messages** (Backend + Frontend)
5. **Phase 5: Group Chat Management** (Backend + Frontend)

Each phase includes:
- Database entity updates
- DTO creation/updates
- Service layer changes
- Controller endpoints
- WebSocket handlers (where needed)
- Frontend components and state management
- Testing verification

---

## Files to Modify/Create

### Backend - Modify
- `Message.java` - Add edited, editedAt, deleted, replyTo fields
- `User.java` - Add bio, displayName fields
- `MessageDTO.java` - Add reply info, edited info
- `SendMessageDTO.java` - Add replyToMessageId
- `ChatMessageEvent.java` - Add replyToMessageId
- `MessageService.java` - Add edit, delete, search methods
- `ChatRoomService.java` - Add group management methods
- `MessageController.java` - Add edit, delete, search endpoints
- `ChatRoomController.java` - Add group management endpoints
- `ChatWebSocketController.java` - Add edit, delete handlers
- `MessageRepository.java` - Add search query

### Backend - Create
- `EditMessageDTO.java`
- `MessageEditUpdateDTO.java`
- `UserProfileDTO.java`
- `GroupInfoDTO.java`
- `UserProfileController.java`

### Frontend - Modify
- `Chat.jsx` - Add reply state, search, profile modals
- `MessageItem.jsx` - Add edit/delete/reply UI
- `WebSocketContext.jsx` - Add edit/delete/reply subscriptions
- `api.js` - Add all new API functions
- `ChatSidebar.jsx` - Add profile button, admin badge

### Frontend - Create
- `ProfileModal.jsx`
- `UserProfileModal.jsx`
- `SearchModal.jsx`
- `GroupInfoModal.jsx`