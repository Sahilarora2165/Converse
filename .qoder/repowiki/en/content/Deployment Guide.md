# Deployment Guide

<cite>
**Referenced Files in This Document**
- [docker-compose.yml](file://docker-compose.yml)
- [dockerfile](file://dockerfile)
- [chatify-frontend/Dockerfile](file://chatify-frontend/Dockerfile)
- [pom.xml](file://pom.xml)
- [chatify-frontend/package.json](file://chatify-frontend/package.json)
- [chatify-frontend/vite.config.js](file://chatify-frontend/vite.config.js)
- [chatify-frontend/nginx.conf](file://chatify-frontend/nginx.conf)
- [src/main/resources/application.properties](file://src/main/resources/application.properties)
- [src/main/resources/application-docker.properties](file://src/main/resources/application-docker.properties)
- [src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java](file://src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java)
- [src/main/java/com/chatify/chat_backend/ChatBackendApplication.java](file://src/main/java/com/chatify/chat_backend/ChatBackendApplication.java)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This guide provides production-ready deployment strategies for Chatify, a real-time chat application built with Spring Boot (backend) and React (frontend). It covers containerization with Docker, orchestration using docker-compose, environment configuration for production, build processes for backend and frontend, infrastructure and scaling considerations for WebSocket connections, monitoring recommendations, security hardening, backup and disaster recovery, and step-by-step deployment instructions for Docker Swarm, Kubernetes, and cloud platforms.

## Project Structure
Chatify consists of:
- Backend: Spring Boot application packaged as a multi-stage Docker image.
- Frontend: React application built with Vite and served via Nginx in a separate container.
- Supporting services: PostgreSQL, Redis, ZooKeeper, and Kafka.

```mermaid
graph TB
subgraph "Compose Services"
A["postgres<br/>PostgreSQL 16"]
B["redis<br/>Redis 7"]
C["zookeeper<br/>Confluent ZooKeeper"]
D["kafka<br/>Confluent Kafka"]
E["app<br/>Spring Boot API"]
F["frontend<br/>React + Nginx"]
end
F --> |"HTTP /api/, /ws, /oauth2/*"| E
E --> |"JDBC"| A
E --> |"Redis ops"| B
E --> |"Kafka producers/consumers"| D
D --> |"depends on"| C
```

**Diagram sources**
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)

**Section sources**
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)
- [README.md:1-216](file://README.md#L1-L216)

## Core Components
- Backend service (app): Multi-stage Docker build using Maven and Eclipse Temurin 17 JRE. Runs on port 8080.
- Frontend service (frontend): Multi-stage build using Node 20 Alpine, Vite, and Nginx serving compiled assets.
- Database (postgres): Persistent volume-backed PostgreSQL 16 with health checks.
- Caching/Presence (redis): Password-protected Redis 7 with persistence.
- Streaming (kafka + zookeeper): Confluent Kafka with ZooKeeper; advertised listeners configured for Docker networking.
- Orchestration: docker-compose defines environment variables, health checks, and inter-service dependencies.

Key production configuration points:
- Environment variables for secrets and external integrations are injected via docker-compose.
- Backend reads production defaults from application properties and profile-specific overrides.
- Frontend builds accept compile-time environment variables for API and WebSocket base URLs.

**Section sources**
- [dockerfile:1-25](file://dockerfile#L1-L25)
- [chatify-frontend/Dockerfile:1-24](file://chatify-frontend/Dockerfile#L1-L24)
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)
- [src/main/resources/application.properties:1-75](file://src/main/resources/application.properties#L1-L75)
- [src/main/resources/application-docker.properties:1-15](file://src/main/resources/application-docker.properties#L1-L15)

## Architecture Overview
The runtime architecture comprises:
- Nginx reverse proxy handling REST API, WebSocket upgrades, OAuth2 redirects, and static assets.
- Spring Boot backend exposing REST endpoints, STOMP/WebSocket endpoints, and file uploads.
- PostgreSQL for relational data.
- Redis for caching and presence tracking.
- Kafka for asynchronous messaging and event streaming.

```mermaid
graph TB
Client["Browser (React SPA)"]
subgraph "Ingress"
Nginx["nginx.conf<br/>/api/, /ws, /oauth2/, /uploads/"]
end
subgraph "Backend"
SB["Spring Boot App<br/>REST + STOMP + Kafka + Redis + DB"]
end
DB["PostgreSQL"]
Cache["Redis"]
Stream["Kafka + ZooKeeper"]
Client --> Nginx
Nginx --> |"REST"| SB
Nginx --> |"WS"| SB
Nginx --> |"OAuth2 init"| SB
Nginx --> |"Files"| SB
SB --> DB
SB --> Cache
SB --> Stream
```

**Diagram sources**
- [chatify-frontend/nginx.conf:1-61](file://chatify-frontend/nginx.conf#L1-L61)
- [src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java:1-111](file://src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java#L1-L111)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java:1-120](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java#L1-L120)
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)

## Detailed Component Analysis

### Backend Containerization and Build
- Multi-stage build:
  - Build stage: Maven 3.9.6 with Eclipse Temurin 17, offline dependency resolution, and packaging without tests.
  - Runtime stage: Eclipse Temurin 17 JRE Jammy minimal image, non-root user, dedicated uploads directory, and exposed port 8080.
- Entrypoint runs the Spring Boot JAR.

Build-time and runtime considerations:
- Keep the runtime image small and immutable.
- Ensure uploads directory permissions are set for the non-root user.

**Section sources**
- [dockerfile:1-25](file://dockerfile#L1-L25)
- [pom.xml:1-176](file://pom.xml#L1-L176)

### Frontend Containerization and Build
- Multi-stage build:
  - Build stage: Node 20 Alpine, install dependencies, copy source, build with Vite.
  - Runtime stage: Nginx Alpine, serve dist, apply nginx.conf.
- Build args enable injecting API and WebSocket base URLs at build time.
- Nginx routes:
  - REST API to backend.
  - WebSocket upgrade to backend.
  - OAuth2 authorization initiation to backend.
  - Uploaded files to backend.
  - SPA routing fallback to index.html.

**Section sources**
- [chatify-frontend/Dockerfile:1-24](file://chatify-frontend/Dockerfile#L1-L24)
- [chatify-frontend/vite.config.js:1-21](file://chatify-frontend/vite.config.js#L1-L21)
- [chatify-frontend/nginx.conf:1-61](file://chatify-frontend/nginx.conf#L1-L61)
- [chatify-frontend/package.json:1-40](file://chatify-frontend/package.json#L1-L40)

### Environment Variables and Configuration
Production-grade environment variables are defined in docker-compose and consumed by the backend and frontend:

Backend (application.properties and docker profile):
- Database: JDBC URL, username, password.
- Redis: host, port, password.
- JWT: secret and refresh token expiration.
- OAuth2: Google client ID/secret and redirect URI.
- CORS: allowed origins.
- AWS S3: access key, secret key, bucket name, region.
- Kafka: bootstrap servers.

Frontend (Dockerfile build args and Nginx):
- VITE_API_URL and VITE_WS_URL for API and WebSocket base URLs.
- Nginx proxies API, WS, OAuth2, and uploads to the backend.

**Section sources**
- [docker-compose.yml:93-112](file://docker-compose.yml#L93-L112)
- [src/main/resources/application.properties:1-75](file://src/main/resources/application.properties#L1-L75)
- [src/main/resources/application-docker.properties:1-15](file://src/main/resources/application-docker.properties#L1-L15)
- [chatify-frontend/Dockerfile:5-11](file://chatify-frontend/Dockerfile#L5-L11)
- [chatify-frontend/nginx.conf:12-61](file://chatify-frontend/nginx.conf#L12-L61)

### Database Connectivity and Pooling
- JDBC URL is configured via environment variable and defaults to localhost for local runs.
- In production, use the docker network alias for PostgreSQL (as per docker-compose).
- Recommended pooling settings (to be applied in production configuration):
  - HikariCP pool size tuned to CPU cores and workload.
  - Connection timeout and leak detection enabled.
  - Read-replica support if scaling reads separately.
- Hibernate DDL auto is set to update; in production, prefer explicit migrations.

**Section sources**
- [docker-compose.yml:95-97](file://docker-compose.yml#L95-L97)
- [src/main/resources/application.properties:1-11](file://src/main/resources/application.properties#L1-L11)

### External Service Integrations
- Redis: Used for caching and presence tracking; requires password protection.
- Kafka: Producer and consumer configurations include serializers, acks, retries, idempotence, and trusted packages for JSON deserialization.
- AWS S3: Credentials and bucket configuration for file uploads and pre-signed URLs.

**Section sources**
- [docker-compose.yml:106-110](file://docker-compose.yml#L106-L110)
- [src/main/resources/application.properties:46-75](file://src/main/resources/application.properties#L46-L75)

### WebSocket and Real-Time Messaging
- STOMP endpoint with SockJS enabled and configurable allowed origins.
- JWT validation on WebSocket CONNECT frames.
- Heartbeats configured via a dedicated scheduler.
- Frontend uses SockJS and STOMP over WebSocket for real-time features.

```mermaid
sequenceDiagram
participant Browser as "React SPA"
participant Nginx as "Nginx"
participant App as "Spring Boot"
participant Redis as "Redis"
participant DB as "PostgreSQL"
Browser->>Nginx : "Connect /ws (upgrade)"
Nginx->>App : "Proxy WS upgrade"
App->>App : "Validate JWT in CONNECT"
App-->>Browser : "STOMP connected"
Browser->>App : "Subscribe /topic, /user"
App->>Redis : "Presence updates"
App->>DB : "Persist messages"
App-->>Browser : "Deliver messages"
```

**Diagram sources**
- [chatify-frontend/nginx.conf:21-31](file://chatify-frontend/nginx.conf#L21-L31)
- [src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java:68-110](file://src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java#L68-L110)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java:61-90](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java#L61-L90)

**Section sources**
- [src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java:1-111](file://src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java#L1-L111)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java:1-120](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java#L1-L120)
- [chatify-frontend/nginx.conf:21-31](file://chatify-frontend/nginx.conf#L21-L31)

### OAuth2 and Security Settings
- Google OAuth2 client configuration is environment-driven.
- CORS allows specified origins and credentials.
- JWT secret and refresh token expiration are configurable.
- CSRF disabled for stateless REST APIs; sessions optional.

Recommendations:
- Enforce HTTPS in production and secure cookies.
- Rotate JWT secrets regularly.
- Limit OAuth2 redirect URIs to production domains.

**Section sources**
- [docker-compose.yml:99-103](file://docker-compose.yml#L99-L103)
- [src/main/resources/application.properties:32-40](file://src/main/resources/application.properties#L32-L40)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java:61-90](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java#L61-L90)

## Dependency Analysis
Inter-service dependencies and coupling:
- app depends on postgres, redis, and kafka (after zookeeper health).
- frontend depends on app.
- Health checks ensure readiness before startup.

```mermaid
graph LR
Postgres["postgres"] --> App["app"]
Redis["redis"] --> App
Zoo["zookeeper"] --> Kafka["kafka"]
Kafka --> App
App --> Frontend["frontend"]
```

**Diagram sources**
- [docker-compose.yml:59-119](file://docker-compose.yml#L59-L119)

**Section sources**
- [docker-compose.yml:1-137](file://docker-compose.yml#L1-L137)

## Performance Considerations
- WebSocket scaling:
  - Use sticky sessions or shared state for presence if deploying behind load balancers.
  - Consider clustering or broker sharding for high concurrency.
- Database:
  - Tune connection pool size and timeouts.
  - Use read replicas for heavy read workloads.
- Caching:
  - Leverage Redis for hot data and rate limiting.
- Kafka:
  - Increase partitions for throughput; monitor consumer lag.
- Frontend:
  - Enable gzip/brotli in Nginx; cache static assets aggressively.
- JVM:
  - Set appropriate heap and GC settings in production (outside current Dockerfile).

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common deployment issues and resolutions:
- WebSocket connection failures:
  - Verify allowed origins and JWT validity.
  - Confirm Nginx WebSocket upgrade headers and proxy_read_timeout.
- CORS errors:
  - Ensure allowed origins include frontend domains.
- Database connectivity:
  - Confirm JDBC URL, credentials, and network reachability.
- OAuth2 redirect loops:
  - Validate redirect URI and cookie settings.
- Build failures:
  - Ensure Java 17 and Node 20 are available; clear caches if needed.

**Section sources**
- [README.md:187-208](file://README.md#L187-L208)
- [chatify-frontend/nginx.conf:21-31](file://chatify-frontend/nginx.conf#L21-L31)
- [src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java:68-110](file://src/main/java/com/chatify/chat_backend/config/WebSocketConfig.java#L68-L110)
- [src/main/java/com/chatify/chat_backend/config/SecurityConfig.java:107-119](file://src/main/java/com/chatify/chat_backend/config/SecurityConfig.java#L107-L119)

## Conclusion
This guide outlines a production-ready deployment strategy for Chatify using Docker and docker-compose. By leveraging environment-driven configuration, multi-stage builds, and robust service dependencies, you can deploy a scalable, secure, and observable chat platform. Extend the approach to Docker Swarm or Kubernetes by translating compose services into native manifests while preserving the same configuration model.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Step-by-Step Deployment Instructions

- Docker Compose (single-host)
  - Prepare environment variables for secrets and integrations.
  - Start services: pull images and run with health checks.
  - Access frontend on port 80; backend on port 8080.
  - Verify health checks and logs.

- Docker Swarm
  - Convert compose to stack file; define secrets for sensitive variables.
  - Deploy stack; scale services as needed.
  - Configure ingress networks and external load balancing.

- Kubernetes
  - Define ConfigMaps for environment variables and Nginx config.
  - Define Secrets for database passwords, JWT secret, and AWS keys.
  - Deploy StatefulSets for PostgreSQL and Redis with persistent volumes.
  - Deploy Deployments for Kafka/ZooKeeper and the backend.
  - Deploy Deployment for the frontend with Nginx.
  - Expose services via LoadBalancer or Ingress.

- Cloud Platforms (e.g., AWS/GCP/Azure)
  - Use managed services:
    - RDS for PostgreSQL.
    - ElastiCache or managed Redis.
    - MSK or managed Kafka.
    - S3 for file storage.
  - Containerize and push images to ECR/GCR/Azure Container Registry.
  - Deploy orchestrator-managed clusters or serverless container services.

[No sources needed since this section provides general guidance]

### Security Hardening Checklist
- TLS termination at Nginx or ingress controller; enforce HTTPS.
- Store secrets in vaults or managed secret stores.
- Restrict Kafka/ZooKeeper exposure; use private subnets.
- Harden PostgreSQL with pg_hba.conf and network policies.
- Enforce JWT expiration and refresh token rotation.
- Audit CORS and cookie security flags.
- Regular vulnerability scans and dependency updates.

[No sources needed since this section provides general guidance]

### Backup and Disaster Recovery
- PostgreSQL:
  - Schedule logical backups (e.g., WAL-G or pg_dump).
  - Test restore procedures; maintain offsite copies.
- Redis:
  - Enable RDB/AOF persistence; snapshot and append-only file backups.
- Kafka:
  - Retention and replication configured; monitor ISR and under-replicated partitions.
- Frontend:
  - Versioned artifacts; rollback to previous Nginx image tag.
- DR Plan:
  - Geo-redundant regions; failover DNS or load balancer rules.

[No sources needed since this section provides general guidance]

### Monitoring and Observability
- Metrics:
  - JVM metrics via Micrometer; expose Prometheus scrape endpoint.
  - Kafka consumer lag and producer metrics.
  - Database connection pool metrics.
- Logs:
  - Centralized logging (ELK or similar) for all services.
- Tracing:
  - Distributed tracing for request flows across services.
- Alerts:
  - Health check failures, OOM, disk pressure, and latency SLO breaches.

[No sources needed since this section provides general guidance]