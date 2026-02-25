# Message Delivery & Seen System — Design & Implementation Notes

## Purpose
This document explains how message delivery states are implemented in this chat application.
The goal is correctness, crash safety, and clear reasoning — not UI hacks.

This system answers:
- When is a message considered sent?
- When is it considered delivered?
- When is it considered seen?
- What happens if users go offline?
- What happens if the server crashes mid-flow?

---

## Core Principle (Single Source of Truth)

The **server is the authority** for all message states.

Clients:
- Never decide delivery
- Never assume seen
- Only send acknowledgements (ACKs)

The database reflects the truth.

---

## Message Lifecycle (State Machine)

Messages move in **one direction only**:
SENT → DELIVERED → SEEN


No backward transitions. No shortcuts.

### State Definitions

- **SENT**
    - Message has been successfully persisted in the database.
    - No assumption about recipient availability.

- **DELIVERED**
    - Recipient explicitly ACKed that messages were received.
    - Not based on presence or socket connection alone.

- **SEEN**
    - Recipient explicitly ACKed that messages were viewed.
    - Happens only when the chat is opened.

---

## Authority Model

| Action | Triggered By | Validated By |
|------|------------|-------------|
| SENT | Server | Server |
| DELIVERED | Recipient ACK | Server |
| SEEN | Recipient ACK | Server |

Clients can lie.  
The server never assumes.

---

## Data Model

### Message Entity (Relevant Fields)

- `status` → `SENT | DELIVERED | SEEN`
- `deliveredAt` → timestamp for delivery
- `seenAt` → timestamp for seen
- `sender`
- `chatRoom`

`readBy` exists but is **not used for SEEN state** (reserved for group extensions).

---

## Delivery Acknowledgement (Batched)

### Client Responsibility
When a recipient receives messages in a chat:
- Client sends a **batched delivery ACK**:
    - `chatRoomId`
    - `lastDeliveredMessageId`

### Server Responsibility
On receiving ACK:
1. Validate user belongs to chat
2. Find messages:
    - Same chat
    - Sent by someone else
    - Status = `SENT`
    - ID ≤ `lastDeliveredMessageId`
3. Mark them:
    - `status = DELIVERED`
    - `deliveredAt = now`
4. Persist changes
5. Notify senders (batched)

---

## Seen Acknowledgement (Batched)

### Client Responsibility
When a recipient opens a chat:
- Client sends a **batched seen ACK**:
    - `chatRoomId`
    - `lastSeenMessageId`

### Server Responsibility
On receiving ACK:
1. Validate user belongs to chat
2. Find messages:
    - Same chat
    - Sent by someone else
    - Status = `DELIVERED`
    - ID ≤ `lastSeenMessageId`
3. Mark them:
    - `status = SEEN`
    - `seenAt = now`
4. Persist changes
5. Notify senders (batched)

---

## WebSocket Events (Conceptual)

### Incoming (Client → Server)
- `/chat.delivered`
- `/chat.seen`

### Outgoing (Server → Clients)
- `/topic/chatroom/{chatId}/delivery`
- `/topic/chatroom/{chatId}/seen`

Events are **batched**, never per-message.

---

## Failure Scenarios & Guarantees

### User Goes Offline Mid-Message
- No ACK received → message stays `SENT`
- On reconnect → client re-ACKs
- Server safely updates state later

### Server Crashes After DB Save
- Message is already `SENT`
- No delivery assumed
- On reconnect → delivery proceeds normally

### Duplicate ACKs
- Safe and idempotent
- Only `SENT → DELIVERED` or `DELIVERED → SEEN` allowed

---

## Guarantees Provided

✔ No false delivery  
✔ No false seen  
✔ Crash-safe  
✔ Offline-safe  
✔ Batched & scalable

---

## Guarantees Not Attempted

✖ Exactly-once delivery  
✖ Real-time ordering guarantees across crashes

(At-least-once delivery is intentional and acceptable.)

---

## Why This Design

- Matches real-world systems (WhatsApp / Slack class)
- Explainable in interviews
- Avoids UI-driven lies
- Clean separation of concerns

This document is the contract.  
Implementation follows it strictly.

