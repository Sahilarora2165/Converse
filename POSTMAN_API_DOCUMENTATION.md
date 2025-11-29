# Chatify API Documentation

This document provides comprehensive API documentation for the Chatify real-time messaging application.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Authentication APIs](#authentication-apis)
3. [User Management APIs](#user-management-apis)
4. [Chat Room APIs](#chat-room-apis)
5. [Messaging APIs](#messaging-apis)
6. [File Upload API](#file-upload-api)
7. [WebSocket Testing Guide](#websocket-testing-guide)

---

## Environment Setup

### Postman Environment Variables

Create a new environment in Postman with the following variables:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `baseUrl` | `http://localhost:8080` | Base URL of the API server |
| `accessToken` | (empty) | JWT access token (auto-populated after login) |
| `refreshToken` | (empty) | Refresh token (auto-populated after login) |
| `userId` | (empty) | Current user's ID (auto-populated after login) |
| `wsUrl` | `ws://localhost:8080/ws` | WebSocket connection URL |

### Headers

Most authenticated endpoints require:
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

---

## Authentication APIs

### 1. Register New User

Register a new user account.

**Endpoint:** `POST /api/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123!"
}
```

**Success Response (200 OK):**
```json
"User registered successfully"
```

**Error Response (400 Bad Request):**
```json
"Username already taken: johndoe"
```
or
```json
"Email already registered: john@example.com"
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

---

### 2. Login

Authenticate a user and receive access tokens.

**Endpoint:** `POST /api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
    "email": "john@example.com",
    "password": "SecurePass123!"
}
```

**Success Response (200 OK):**
```json
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john@example.com"
}
```

**Error Response (401 Unauthorized):**
```json
"Invalid email or password"
```

**Postman Test Script (to auto-save tokens):**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.environment.set("accessToken", response.accessToken);
    pm.environment.set("refreshToken", response.refreshToken);
}
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

---

### 3. Refresh Token

Get a new access token using a refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
    "refreshToken": "{{refreshToken}}"
}
```

**Success Response (200 OK):**
```json
{
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "660e8400-e29b-41d4-a716-446655440001",
    "username": "johndoe",
    "email": "john@example.com"
}
```

**Error Response (401 Unauthorized):**
Empty response body

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

### 4. Logout

Invalidate the user's refresh token.

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Success Response (200 OK):**
```json
"Logged out successfully"
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/auth/logout" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

## User Management APIs

### 1. Get All Users

Retrieve a list of all registered users.

**Endpoint:** `GET /api/users`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "profilePicture": null,
        "status": "ONLINE",
        "lastSeen": "2024-01-15T10:30:00",
        "createdAt": "2024-01-01T08:00:00"
    },
    {
        "id": 2,
        "username": "janedoe",
        "email": "jane@example.com",
        "profilePicture": "/uploads/profile2.jpg",
        "status": "OFFLINE",
        "lastSeen": "2024-01-14T22:00:00",
        "createdAt": "2024-01-02T09:00:00"
    }
]
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 2. Get User by ID

Retrieve a specific user's profile.

**Endpoint:** `GET /api/users/{id}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | User ID |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "profilePicture": null,
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00",
    "createdAt": "2024-01-01T08:00:00"
}
```

**Error Response (404 Not Found):**
```json
{
    "status": 404,
    "message": "User not found with id: 999",
    "timestamp": "2024-01-15T10:35:00",
    "path": "/api/users/999"
}
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users/1" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 3. Get Current User

Retrieve the authenticated user's profile.

**Endpoint:** `GET /api/users/me`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Success Response (200 OK):**
```json
{
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "profilePicture": null,
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00",
    "createdAt": "2024-01-01T08:00:00"
}
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users/me" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 4. Search Users

Search for users by username or email.

**Endpoint:** `GET /api/users/search?query={searchTerm}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | String | Search term (matches username or email) |

**Success Response (200 OK):**
```json
[
    {
        "id": 2,
        "username": "janedoe",
        "email": "jane@example.com",
        "profilePicture": null,
        "status": "OFFLINE",
        "lastSeen": "2024-01-14T22:00:00",
        "createdAt": "2024-01-02T09:00:00"
    }
]
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users/search?query=jane" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 5. Update User Status

Update the user's online status.

**Endpoint:** `PUT /api/users/{id}/status`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | User ID (must match authenticated user) |

**Request Body:**
```json
{
    "status": "ONLINE"
}
```

**Status Values:**
- `ONLINE` - User is active
- `OFFLINE` - User is offline
- `AWAY` - User is away

**Success Response (200 OK):**
```json
{
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "profilePicture": null,
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00",
    "createdAt": "2024-01-01T08:00:00"
}
```

**Error Response (403 Forbidden):**
Empty response (user trying to update another user's status)

**cURL Example:**
```bash
curl -X PUT "{{baseUrl}}/api/users/1/status" \
  -H "Authorization: Bearer {{accessToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "AWAY"
  }'
```

---

### 6. Get User Presence

Get the online status and last seen time of a user.

**Endpoint:** `GET /api/users/{id}/presence`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | User ID |

**Success Response (200 OK):**
```json
{
    "userId": 1,
    "username": "johndoe",
    "status": "ONLINE",
    "lastSeen": "2024-01-15T10:30:00"
}
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users/1/presence" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 7. Get Online Users

Get a list of all currently online users.

**Endpoint:** `GET /api/users/online`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "profilePicture": null,
        "status": "ONLINE",
        "lastSeen": null,
        "createdAt": "2024-01-01T08:00:00"
    }
]
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/users/online" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

## Chat Room APIs

### 1. Create Chat Room

Create a private (1-on-1) or group chat room.

**Endpoint:** `POST /api/chatrooms`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Request Body (Private Chat):**
```json
{
    "isGroupChat": false,
    "participantIds": [2]
}
```

**Request Body (Group Chat):**
```json
{
    "name": "Project Team",
    "isGroupChat": true,
    "participantIds": [2, 3, 4]
}
```

**Success Response (201 Created):**
```json
{
    "id": 1,
    "name": "Project Team",
    "isGroupChat": true,
    "participants": [
        {
            "id": 1,
            "username": "johndoe",
            "email": "john@example.com",
            "profilePicture": null,
            "status": "ONLINE",
            "lastSeen": null,
            "createdAt": "2024-01-01T08:00:00"
        },
        {
            "id": 2,
            "username": "janedoe",
            "email": "jane@example.com",
            "profilePicture": null,
            "status": "OFFLINE",
            "lastSeen": "2024-01-14T22:00:00",
            "createdAt": "2024-01-02T09:00:00"
        }
    ],
    "admin": {
        "id": 1,
        "username": "johndoe",
        "email": "john@example.com",
        "profilePicture": null,
        "status": "ONLINE",
        "lastSeen": null,
        "createdAt": "2024-01-01T08:00:00"
    },
    "createdAt": "2024-01-15T11:00:00",
    "unreadCount": 0
}
```

**Error Response (400 Bad Request):**
```json
{
    "status": 400,
    "message": "Group chat name is required",
    "timestamp": "2024-01-15T11:00:00",
    "path": "/api/chatrooms"
}
```

**cURL Example (Group Chat):**
```bash
curl -X POST "{{baseUrl}}/api/chatrooms" \
  -H "Authorization: Bearer {{accessToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Project Team",
    "isGroupChat": true,
    "participantIds": [2, 3, 4]
  }'
```

---

### 2. Get User's Chat Rooms

Get all chat rooms the authenticated user is a participant in.

**Endpoint:** `GET /api/chatrooms`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "name": "Project Team",
        "isGroupChat": true,
        "participants": [...],
        "admin": {...},
        "createdAt": "2024-01-15T11:00:00",
        "unreadCount": 5
    },
    {
        "id": 2,
        "name": null,
        "isGroupChat": false,
        "participants": [...],
        "admin": null,
        "createdAt": "2024-01-15T10:00:00",
        "unreadCount": 0
    }
]
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/chatrooms" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 3. Get Chat Room by ID

Get details of a specific chat room.

**Endpoint:** `GET /api/chatrooms/{id}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | Chat room ID |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "name": "Project Team",
    "isGroupChat": true,
    "participants": [...],
    "admin": {...},
    "createdAt": "2024-01-15T11:00:00",
    "unreadCount": 5
}
```

**Error Response (401 Unauthorized):**
```json
{
    "status": 401,
    "message": "User is not a participant of this chat room",
    "timestamp": "2024-01-15T11:30:00",
    "path": "/api/chatrooms/1"
}
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/chatrooms/1" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 4. Add Participant to Group

Add a new participant to a group chat (admin only).

**Endpoint:** `POST /api/chatrooms/{id}/participants`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | Chat room ID |

**Request Body:**
```json
{
    "userId": 5
}
```

**Success Response (200 OK):**
```json
{
    "id": 1,
    "name": "Project Team",
    "isGroupChat": true,
    "participants": [...],
    "admin": {...},
    "createdAt": "2024-01-15T11:00:00",
    "unreadCount": 0
}
```

**Error Responses:**

400 Bad Request:
```json
{
    "status": 400,
    "message": "Cannot add participants to a private chat",
    "timestamp": "2024-01-15T11:30:00",
    "path": "/api/chatrooms/1/participants"
}
```

401 Unauthorized:
```json
{
    "status": 401,
    "message": "Only the admin can add participants",
    "timestamp": "2024-01-15T11:30:00",
    "path": "/api/chatrooms/1/participants"
}
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/chatrooms/1/participants" \
  -H "Authorization: Bearer {{accessToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 5
  }'
```

---

### 5. Remove Participant from Group

Remove a participant from a group chat (admin only).

**Endpoint:** `DELETE /api/chatrooms/{id}/participants/{userId}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | Chat room ID |
| `userId` | Long | User ID to remove |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "name": "Project Team",
    "isGroupChat": true,
    "participants": [...],
    "admin": {...},
    "createdAt": "2024-01-15T11:00:00",
    "unreadCount": 0
}
```

**cURL Example:**
```bash
curl -X DELETE "{{baseUrl}}/api/chatrooms/1/participants/5" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

## Messaging APIs

### 1. Send Message

Send a text message to a chat room.

**Endpoint:** `POST /api/messages`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

**Request Body:**
```json
{
    "chatRoomId": 1,
    "content": "Hello everyone!",
    "messageType": "TEXT"
}
```

**Message Types:**
- `TEXT` - Regular text message
- `IMAGE` - Image attachment
- `FILE` - File attachment

**Success Response (201 Created):**
```json
{
    "id": 1,
    "content": "Hello everyone!",
    "messageType": "TEXT",
    "fileUrl": null,
    "fileName": null,
    "senderId": 1,
    "senderUsername": "johndoe",
    "chatRoomId": 1,
    "timestamp": "2024-01-15T12:00:00",
    "readByUserIds": [],
    "delivered": true
}
```

**Error Response (401 Unauthorized):**
```json
{
    "status": 401,
    "message": "User is not a participant of this chat room",
    "timestamp": "2024-01-15T12:00:00",
    "path": "/api/messages"
}
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/messages" \
  -H "Authorization: Bearer {{accessToken}}" \
  -H "Content-Type: application/json" \
  -d '{
    "chatRoomId": 1,
    "content": "Hello everyone!",
    "messageType": "TEXT"
  }'
```

---

### 2. Get Messages in Chat Room

Retrieve all messages in a chat room.

**Endpoint:** `GET /api/messages/chatroom/{chatRoomId}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatRoomId` | Long | Chat room ID |

**Success Response (200 OK):**
```json
[
    {
        "id": 1,
        "content": "Hello everyone!",
        "messageType": "TEXT",
        "fileUrl": null,
        "fileName": null,
        "senderId": 1,
        "senderUsername": "johndoe",
        "chatRoomId": 1,
        "timestamp": "2024-01-15T12:00:00",
        "readByUserIds": [1, 2],
        "delivered": true
    },
    {
        "id": 2,
        "content": "Hi John!",
        "messageType": "TEXT",
        "fileUrl": null,
        "fileName": null,
        "senderId": 2,
        "senderUsername": "janedoe",
        "chatRoomId": 1,
        "timestamp": "2024-01-15T12:01:00",
        "readByUserIds": [2],
        "delivered": true
    }
]
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/messages/chatroom/1" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 3. Get Messages (Paginated)

Retrieve messages in a chat room with pagination.

**Endpoint:** `GET /api/messages/chatroom/{chatRoomId}/paginated`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatRoomId` | Long | Chat room ID |

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 0 | Page number (0-indexed) |
| `size` | int | 20 | Number of messages per page |

**Success Response (200 OK):**
```json
{
    "content": [
        {
            "id": 2,
            "content": "Hi John!",
            "messageType": "TEXT",
            ...
        }
    ],
    "pageable": {
        "pageNumber": 0,
        "pageSize": 20
    },
    "totalElements": 50,
    "totalPages": 3,
    "last": false,
    "first": true
}
```

**cURL Example:**
```bash
curl -X GET "{{baseUrl}}/api/messages/chatroom/1/paginated?page=0&size=20" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 4. Mark Message as Read

Mark a single message as read (for read receipts).

**Endpoint:** `PUT /api/messages/{id}/read`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | Message ID |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "content": "Hello everyone!",
    "messageType": "TEXT",
    "fileUrl": null,
    "fileName": null,
    "senderId": 1,
    "senderUsername": "johndoe",
    "chatRoomId": 1,
    "timestamp": "2024-01-15T12:00:00",
    "readByUserIds": [1, 2, 3],
    "delivered": true
}
```

**cURL Example:**
```bash
curl -X PUT "{{baseUrl}}/api/messages/1/read" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 5. Mark All Messages as Read

Mark all messages in a chat room as read.

**Endpoint:** `PUT /api/messages/chatroom/{chatRoomId}/read-all`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `chatRoomId` | Long | Chat room ID |

**Success Response (200 OK):**
Empty response body

**cURL Example:**
```bash
curl -X PUT "{{baseUrl}}/api/messages/chatroom/1/read-all" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

### 6. Delete Message

Delete a message (sender only).

**Endpoint:** `DELETE /api/messages/{id}`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | Long | Message ID |

**Success Response (204 No Content):**
Empty response body

**Error Response (401 Unauthorized):**
```json
{
    "status": 401,
    "message": "Only the sender can delete this message",
    "timestamp": "2024-01-15T12:30:00",
    "path": "/api/messages/1"
}
```

**cURL Example:**
```bash
curl -X DELETE "{{baseUrl}}/api/messages/1" \
  -H "Authorization: Bearer {{accessToken}}"
```

---

## File Upload API

### 1. Upload File

Upload a file attachment.

**Endpoint:** `POST /api/messages/upload`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The file to upload |

**Supported File Types:**
- Images: JPEG, PNG, GIF, WEBP
- Documents: PDF, DOC, DOCX, TXT

**Maximum File Size:** 10MB

**Success Response (201 Created):**
```json
{
    "fileName": "document.pdf",
    "fileUrl": "/uploads/550e8400-e29b-41d4-a716-446655440000.pdf",
    "fileType": "application/pdf",
    "fileSize": 1048576
}
```

**Error Responses:**

400 Bad Request (Empty file):
```json
{
    "status": 400,
    "message": "File is empty",
    "timestamp": "2024-01-15T13:00:00",
    "path": "/api/messages/upload"
}
```

400 Bad Request (File too large):
```json
{
    "status": 400,
    "message": "File size exceeds maximum limit of 10MB",
    "timestamp": "2024-01-15T13:00:00",
    "path": "/api/messages/upload"
}
```

400 Bad Request (Invalid file type):
```json
{
    "status": 400,
    "message": "File type not allowed. Allowed types: JPEG, PNG, GIF, WEBP, PDF, DOC, DOCX, TXT",
    "timestamp": "2024-01-15T13:00:00",
    "path": "/api/messages/upload"
}
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/messages/upload" \
  -H "Authorization: Bearer {{accessToken}}" \
  -F "file=@/path/to/document.pdf"
```

---

### 2. Send Message with File

Upload a file and send a message with it in one request.

**Endpoint:** `POST /api/messages/with-file`

**Headers:**
```
Authorization: Bearer {{accessToken}}
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Type | Description |
|-------|------|-------------|
| `chatRoomId` | Long | Target chat room ID |
| `content` | String | Message content |
| `file` | File | The file to upload |

**Success Response (201 Created):**
```json
{
    "id": 5,
    "content": "Check out this document",
    "messageType": "FILE",
    "fileUrl": "/uploads/550e8400-e29b-41d4-a716-446655440000.pdf",
    "fileName": "document.pdf",
    "senderId": 1,
    "senderUsername": "johndoe",
    "chatRoomId": 1,
    "timestamp": "2024-01-15T13:00:00",
    "readByUserIds": [],
    "delivered": true
}
```

**cURL Example:**
```bash
curl -X POST "{{baseUrl}}/api/messages/with-file" \
  -H "Authorization: Bearer {{accessToken}}" \
  -F "chatRoomId=1" \
  -F "content=Check out this document" \
  -F "file=@/path/to/document.pdf"
```

---

## WebSocket Testing Guide

### Connection Setup

**WebSocket URL:** `ws://localhost:8080/ws`

**SockJS URL:** `http://localhost:8080/ws`

### Connection with Authentication

When connecting via WebSocket, include the JWT token in the STOMP CONNECT frame headers:

```javascript
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect(
    { 'Authorization': 'Bearer ' + accessToken },
    function(frame) {
        console.log('Connected: ' + frame);
        // Subscribe to topics here
    },
    function(error) {
        console.error('Connection error: ' + error);
    }
);
```

### Subscribe Destinations

| Destination | Description |
|-------------|-------------|
| `/topic/chatroom/{chatRoomId}` | New messages in a chat room |
| `/topic/chatroom/{chatRoomId}/typing` | Typing indicators in a chat room |
| `/topic/chatroom/{chatRoomId}/read` | Read receipts in a chat room |
| `/topic/presence` | User presence updates (online/offline) |
| `/user/queue/messages` | Private messages for the user |

**Example Subscriptions:**
```javascript
// Subscribe to messages in chat room 1
stompClient.subscribe('/topic/chatroom/1', function(message) {
    const messageDTO = JSON.parse(message.body);
    console.log('New message:', messageDTO);
});

// Subscribe to typing indicators
stompClient.subscribe('/topic/chatroom/1/typing', function(message) {
    const typingStatus = JSON.parse(message.body);
    console.log('Typing:', typingStatus);
});

// Subscribe to read receipts
stompClient.subscribe('/topic/chatroom/1/read', function(message) {
    const readReceipt = JSON.parse(message.body);
    console.log('Read receipt:', readReceipt);
});

// Subscribe to presence updates
stompClient.subscribe('/topic/presence', function(message) {
    const presence = JSON.parse(message.body);
    console.log('User presence:', presence);
});
```

### Send Destinations

| Destination | Description | Payload |
|-------------|-------------|---------|
| `/app/chat.sendMessage` | Send a message | SendMessageDTO |
| `/app/chat.typing/{chatRoomId}` | Send typing indicator | TypingStatusDTO |
| `/app/chat.read/{messageId}` | Mark message as read | - |
| `/app/presence.update` | Update presence status | OnlineStatusDTO |
| `/app/presence.connected` | Notify user connected | - |
| `/app/presence.disconnected` | Notify user disconnected | - |

### Message Formats

#### Send Message
```javascript
stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
    chatRoomId: 1,
    content: 'Hello from WebSocket!',
    messageType: 'TEXT'
}));
```

#### Typing Indicator
```javascript
// Start typing
stompClient.send('/app/chat.typing/1', {}, JSON.stringify({
    isTyping: true
}));

// Stop typing
stompClient.send('/app/chat.typing/1', {}, JSON.stringify({
    isTyping: false
}));
```

#### Mark Message as Read
```javascript
stompClient.send('/app/chat.read/5', {}, '');
```

#### Update Presence
```javascript
stompClient.send('/app/presence.update', {}, JSON.stringify({
    status: 'AWAY'
}));
```

#### Notify Connected
```javascript
stompClient.send('/app/presence.connected', {}, '');
```

### Sample WebSocket Flow

1. **Connect and authenticate:**
```javascript
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);
stompClient.connect({ 'Authorization': 'Bearer ' + token }, onConnected, onError);
```

2. **On connect, notify presence and subscribe:**
```javascript
function onConnected(frame) {
    // Notify server that user is connected
    stompClient.send('/app/presence.connected', {}, '');
    
    // Subscribe to chat room messages
    stompClient.subscribe('/topic/chatroom/1', handleNewMessage);
    stompClient.subscribe('/topic/chatroom/1/typing', handleTypingIndicator);
    stompClient.subscribe('/topic/presence', handlePresenceUpdate);
}
```

3. **Handle incoming messages:**
```javascript
function handleNewMessage(message) {
    const msg = JSON.parse(message.body);
    displayMessage(msg);
    // Mark as read
    stompClient.send('/app/chat.read/' + msg.id, {}, '');
}

function handleTypingIndicator(message) {
    const status = JSON.parse(message.body);
    if (status.isTyping) {
        showTypingIndicator(status.username);
    } else {
        hideTypingIndicator(status.username);
    }
}

function handlePresenceUpdate(message) {
    const presence = JSON.parse(message.body);
    updateUserStatus(presence.userId, presence.status);
}
```

4. **Send messages and typing indicators:**
```javascript
function sendMessage(content) {
    stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
        chatRoomId: currentChatRoomId,
        content: content,
        messageType: 'TEXT'
    }));
}

let typingTimer;
function handleTyping() {
    stompClient.send('/app/chat.typing/' + currentChatRoomId, {}, JSON.stringify({
        isTyping: true
    }));
    
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stompClient.send('/app/chat.typing/' + currentChatRoomId, {}, JSON.stringify({
            isTyping: false
        }));
    }, 3000);
}
```

5. **On disconnect, notify presence:**
```javascript
window.onbeforeunload = function() {
    stompClient.send('/app/presence.disconnected', {}, '');
    stompClient.disconnect();
};
```

---

## Error Response Format

All API error responses follow this format:

```json
{
    "status": 404,
    "message": "Resource not found with id: 123",
    "timestamp": "2024-01-15T10:30:00",
    "path": "/api/users/123"
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 204 | No Content - Request successful, no body |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required or failed |
| 403 | Forbidden - Access denied |
| 404 | Not Found - Resource not found |
| 500 | Internal Server Error - Server error |

---

## Postman Collection Import

You can import this API documentation as a Postman collection by:

1. Open Postman
2. Click "Import" button
3. Select "Link" tab
4. Paste the raw file URL or import the JSON file
5. Create an environment with the variables listed in [Environment Setup](#environment-setup)

---

## Testing Workflow

1. **Register a test user** using the register endpoint
2. **Login** and save the access token to environment
3. **Get current user** to verify authentication
4. **Create a chat room** with another user
5. **Send messages** via REST API
6. **Connect WebSocket** for real-time features
7. **Test typing indicators** and read receipts
8. **Upload files** and send messages with attachments
9. **Test presence updates** by going online/offline
