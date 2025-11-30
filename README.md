# Chatify - Real-Time Chat Application

Chatify is a modern real-time chat application built with Spring Boot (backend) and React (frontend). It supports private messaging, group chats, file sharing, typing indicators, read receipts, and online/offline status.

## Features

- **User Authentication**: JWT-based authentication with refresh tokens
- **Private Messaging**: One-on-one chat between users
- **Group Chats**: Create and manage group conversations
- **Real-Time Messaging**: WebSocket/STOMP for instant message delivery
- **Typing Indicators**: See when other users are typing
- **Read Receipts**: Know when your messages have been read
- **Online/Offline Status**: See who's currently online
- **File Uploads**: Share images and documents (up to 10MB)
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

### Backend
- Java 17
- Spring Boot 3.5.5
- Spring Security with JWT
- Spring WebSocket (STOMP)
- PostgreSQL
- JPA/Hibernate

### Frontend
- React 19
- Vite
- @stomp/stompjs & sockjs-client
- Tailwind CSS
- React Router
- Axios

## Prerequisites

Before you begin, ensure you have the following installed:

- **Java 17** or higher
- **Node.js 18** or higher
- **PostgreSQL 14** or higher
- **Maven 3.6** or higher

## Setup Instructions

### 1. Database Setup

1. Install PostgreSQL and create a new database:
   ```sql
   CREATE DATABASE chatify;
   CREATE USER chatuser WITH PASSWORD 'chatify911868x';
   GRANT ALL PRIVILEGES ON DATABASE chatify TO chatuser;
   ```

2. Connect to the database and grant schema permissions:
   ```sql
   \c chatify
   GRANT ALL ON SCHEMA public TO chatuser;
   ```

### 2. Backend Setup

1. Navigate to the project root directory:
   ```bash
   cd Chatify
   ```

2. Create the application.properties file (or use the existing one):
   ```bash
   cp src/main/resources/application.properties.example src/main/resources/application.properties
   ```

3. Update the `application.properties` with your database credentials if different from defaults:
   ```properties
   spring.datasource.url=jdbc:postgresql://localhost:5432/chatify
   spring.datasource.username=chatuser
   spring.datasource.password=chatify911868x
   ```

4. Build and run the backend:
   ```bash
   ./mvnw clean install
   ./mvnw spring-boot:run
   ```

   The backend will start on `http://localhost:8080`

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd chatify-frontend
   ```

2. Create the environment file:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:5173`

## Environment Configuration

### Backend (`src/main/resources/application.properties`)

| Property | Description | Default |
|----------|-------------|---------|
| `spring.datasource.url` | PostgreSQL connection URL | `jdbc:postgresql://localhost:5432/chatify` |
| `spring.datasource.username` | Database username | `chatuser` |
| `spring.datasource.password` | Database password | `chatify911868x` |
| `jwt.secret` | JWT signing secret (Base64 encoded) | See properties file |
| `jwt.expiration-ms` | JWT token expiration in milliseconds | `3600000` (1 hour) |
| `cors.allowed-origins` | Allowed CORS origins | `http://localhost:3000,http://localhost:5173` |
| `server.port` | Server port | `8080` |
| `file.upload-dir` | File upload directory | `./uploads` |

### Frontend (`chatify-frontend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8080` |
| `VITE_WS_URL` | WebSocket endpoint URL | `http://localhost:8080/ws` |

## Running the Application

1. Start PostgreSQL service
2. Start the backend: `./mvnw spring-boot:run`
3. Start the frontend: `cd chatify-frontend && npm run dev`
4. Open `http://localhost:5173` in your browser

## API Documentation

See [POSTMAN_API_DOCUMENTATION.md](POSTMAN_API_DOCUMENTATION.md) for detailed API documentation.

## WebSocket Endpoints

| Endpoint | Description |
|----------|-------------|
| `/ws` | WebSocket connection endpoint |
| `/app/chat.sendMessage` | Send a chat message |
| `/app/chat.typing/{chatRoomId}` | Send typing indicator |
| `/app/chat.read/{messageId}` | Mark message as read |
| `/topic/chatroom/{id}` | Subscribe to chat room messages |
| `/topic/chatroom/{id}/typing` | Subscribe to typing indicators |
| `/topic/chatroom/{id}/read` | Subscribe to read receipts |
| `/topic/presence` | Subscribe to presence updates |
| `/user/queue/messages` | User-specific message queue |

## Project Structure

```
Chatify/
├── src/main/java/com/chatify/    # Backend source code
│   ├── controller/               # REST controllers
│   ├── service/                  # Business logic
│   ├── entity/                   # JPA entities
│   ├── dto/                      # Data transfer objects
│   ├── repository/               # Data access layer
│   ├── config/                   # Configuration classes
│   └── exception/                # Custom exceptions
├── src/main/resources/
│   └── application.properties    # Backend configuration
├── chatify-frontend/             # Frontend source code
│   ├── src/
│   │   ├── api/                  # API client functions
│   │   ├── components/           # React components
│   │   ├── context/              # React contexts
│   │   ├── hooks/                # Custom hooks
│   │   ├── pages/                # Page components
│   │   ├── services/             # Service modules
│   │   └── utils/                # Utility functions
│   ├── .env                      # Frontend environment
│   └── .env.example              # Environment template
└── pom.xml                       # Maven configuration
```

## Troubleshooting

### WebSocket Connection Issues

1. Ensure the backend is running on port 8080
2. Check that CORS origins are correctly configured
3. Verify the JWT token is valid and not expired
4. Check browser console for connection errors

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check database credentials in `application.properties`
3. Ensure the database and user exist with proper permissions

### Build Issues

1. Ensure Java 17 is installed: `java -version`
2. Ensure Node.js 18+ is installed: `node -v`
3. Clear Maven cache: `./mvnw clean`
4. Clear npm cache: `npm cache clean --force`

## License

This project is for educational purposes.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
