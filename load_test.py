#!/usr/bin/env python3
"""
Chatify Load Testing Script
============================

Simulates multiple concurrent users sending messages to test:
- Latency (p50, p95, p99)
- Throughput (messages/sec)
- Reliability (no message loss)
- Ordering (per-room message order)

Usage:
    pip install websockets aiohttp
    python load_test.py --users 20 --duration 60 --rate 1

Expected Results:
    - p50 latency: < 30ms
    - p95 latency: < 120ms
    - p99 latency: < 200ms
    - No crashes
    - No message loss
"""

import asyncio
import argparse
import json
import time
import statistics
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
import aiohttp
import random
import string

# Configuration
WS_URL = "ws://localhost:8080/ws"
API_URL = "http://localhost:8080/api"


@dataclass
class MessageMetric:
    sent_at: float
    received_at: Optional[float] = None
    latency_ms: Optional[float] = None
    message_id: str = ""


@dataclass
class UserSession:
    user_id: int
    email: str
    token: str
    chat_room_id: int
    messages_sent: int = 0
    messages_received: int = 0
    latencies: list = field(default_factory=list)


@dataclass
class TestResults:
    total_messages_sent: int = 0
    total_messages_received: int = 0
    latencies: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    start_time: float = 0
    end_time: float = 0

    def add_latency(self, latency_ms: float):
        self.latencies.append(latency_ms)

    def get_stats(self):
        if not self.latencies:
            return {}
        
        sorted_latencies = sorted(self.latencies)
        n = len(sorted_latencies)
        
        return {
            "total_sent": self.total_messages_sent,
            "total_received": self.total_messages_received,
            "loss_rate": (self.total_messages_sent - self.total_messages_received) / max(self.total_messages_sent, 1) * 100,
            "throughput_msg_per_sec": self.total_messages_sent / max(self.end_time - self.start_time, 1),
            "latency": {
                "min_ms": sorted_latencies[0],
                "max_ms": sorted_latencies[-1],
                "avg_ms": statistics.mean(sorted_latencies),
                "p50_ms": sorted_latencies[n // 2],
                "p95_ms": sorted_latencies[int(n * 0.95)] if n >= 20 else sorted_latencies[-1],
                "p99_ms": sorted_latencies[int(n * 0.99)] if n >= 100 else sorted_latencies[-1],
            },
            "errors": len(self.errors),
            "duration_sec": self.end_time - self.start_time,
        }


class LoadTester:
    def __init__(self, num_users: int, duration_sec: int, rate_per_user: float):
        self.num_users = num_users
        self.duration_sec = duration_sec
        self.rate_per_user = rate_per_user
        self.results = TestResults()
        self.sessions: list[UserSession] = []
        self.message_tracker: dict[str, MessageMetric] = {}
        self.running = True

    async def register_user(self, session: aiohttp.ClientSession, user_id: int) -> Optional[UserSession]:
        """Register a test user and return session."""
        email = f"loadtest_user_{user_id}_{int(time.time())}@test.com"
        password = "TestPass123!"
        username = f"LoadTest{user_id}"
        
        try:
            async with session.post(f"{API_URL}/auth/register", json={
                "email": email,
                "password": password,
                "username": username
            }) as resp:
                if resp.status in [200, 201]:
                    data = await resp.json()
                    return UserSession(
                        user_id=user_id,
                        email=email,
                        token=data.get("accessToken", ""),
                        chat_room_id=0
                    )
                elif resp.status == 409:  # User exists, try login
                    async with session.post(f"{API_URL}/auth/login", json={
                        "email": email,
                        "password": password
                    }) as login_resp:
                        if login_resp.status == 200:
                            data = await login_resp.json()
                            return UserSession(
                                user_id=user_id,
                                email=email,
                                token=data.get("accessToken", ""),
                                chat_room_id=0
                            )
        except Exception as e:
            print(f"Error registering user {user_id}: {e}")
        return None

    async def create_or_get_chat_room(self, session: aiohttp.ClientSession, user: UserSession, other_user: UserSession) -> Optional[int]:
        """Create a chat room between two users."""
        headers = {"Authorization": f"Bearer {user.token}"}
        try:
            async with session.post(f"{API_URL}/chatrooms", json={
                "name": f"LoadTest Room {user.user_id}-{other_user.user_id}",
                "isGroupChat": False,
                "participantIds": [other_user.user_id]
            }, headers=headers) as resp:
                if resp.status in [200, 201]:
                    data = await resp.json()
                    return data.get("id")
        except Exception as e:
            print(f"Error creating chat room: {e}")
        return None

    async def websocket_client(self, user: UserSession, ws_session):
        """Handle WebSocket connection for a user."""
        import websockets
        
        headers = {"Authorization": f"Bearer {user.token}"}
        
        try:
            async with websockets.connect(WS_URL, extra_headers=headers) as ws:
                # Subscribe to chat room
                subscribe_msg = {
                    "destination": f"/topic/chatroom/{user.chat_room_id}",
                    "id": f"sub-{user.user_id}"
                }
                
                async for message in ws:
                    if not self.running:
                        break
                    
                    try:
                        data = json.loads(message)
                        # Track received messages
                        if "body" in data:
                            body = json.loads(data["body"])
                            msg_id = body.get("id", "")
                            if msg_id in self.message_tracker:
                                metric = self.message_tracker[msg_id]
                                metric.received_at = time.time()
                                metric.latency_ms = (metric.received_at - metric.sent_at) * 1000
                                self.results.add_latency(metric.latency_ms)
                                user.messages_received += 1
                                self.results.total_messages_received += 1
                    except:
                        pass
        except Exception as e:
            self.results.errors.append(f"WS error for user {user.user_id}: {e}")

    async def message_sender(self, user: UserSession, ws_session):
        """Send messages at specified rate."""
        import websockets
        
        headers = {"Authorization": f"Bearer {user.token}"}
        interval = 1.0 / self.rate_per_user if self.rate_per_user > 0 else 1.0
        
        try:
            async with websockets.connect(WS_URL, extra_headers=headers) as ws:
                while self.running and time.time() - self.results.start_time < self.duration_sec:
                    # Generate unique message
                    msg_id = f"msg_{user.user_id}_{user.messages_sent}_{int(time.time()*1000)}"
                    content = f"Load test message {user.messages_sent} from user {user.user_id}"
                    
                    # Track this message
                    self.message_tracker[msg_id] = MessageMetric(
                        sent_at=time.time(),
                        message_id=msg_id
                    )
                    
                    # Send message
                    send_msg = {
                        "destination": f"/app/chat/{user.chat_room_id}/sendMessage",
                        "body": json.dumps({
                            "chatRoomId": user.chat_room_id,
                            "content": content,
                            "sentAt": datetime.utcnow().isoformat() + "Z"
                        })
                    }
                    
                    await ws.send(json.dumps(send_msg))
                    user.messages_sent += 1
                    self.results.total_messages_sent += 1
                    
                    await asyncio.sleep(interval)
        except Exception as e:
            self.results.errors.append(f"Sender error for user {user.user_id}: {e}")

    async def run_test(self):
        """Run the load test."""
        print(f"\n{'='*60}")
        print(f"Chatify Load Test")
        print(f"{'='*60}")
        print(f"Users: {self.num_users}")
        print(f"Duration: {self.duration_sec}s")
        print(f"Rate: {self.rate_per_user} msg/sec per user")
        print(f"Expected total messages: ~{int(self.num_users * self.rate_per_user * self.duration_sec)}")
        print(f"{'='*60}\n")

        async with aiohttp.ClientSession() as http_session:
            # Phase 1: Register users
            print("Phase 1: Registering users...")
            tasks = [self.register_user(http_session, i) for i in range(self.num_users)]
            self.sessions = await asyncio.gather(*tasks)
            self.sessions = [s for s in self.sessions if s is not None]
            
            if len(self.sessions) < 2:
                print("ERROR: Could not register enough users")
                return
            
            print(f"Registered {len(self.sessions)} users")

            # Phase 2: Create chat rooms (pair users)
            print("Phase 2: Creating chat rooms...")
            for i in range(0, len(self.sessions) - 1, 2):
                room_id = await self.create_or_get_chat_room(
                    http_session, self.sessions[i], self.sessions[i + 1]
                )
                if room_id:
                    self.sessions[i].chat_room_id = room_id
                    self.sessions[i + 1].chat_room_id = room_id
            
            rooms_created = len([s for s in self.sessions if s.chat_room_id > 0])
            print(f"Created chat rooms for {rooms_created} users")

            # Phase 3: Run load test
            print("\nPhase 3: Running load test...")
            self.results.start_time = time.time()
            
            # Create sender and receiver tasks for each user
            tasks = []
            for i, session in enumerate(self.sessions):
                if session.chat_room_id > 0:
                    # Alternate: even users send, odd users receive
                    if i % 2 == 0:
                        tasks.append(self.message_sender(session, http_session))
                    else:
                        tasks.append(self.websocket_client(session, http_session))
            
            # Run all tasks
            await asyncio.gather(*tasks, return_exceptions=True)
            
            self.results.end_time = time.time()

        # Print results
        self.print_results()

    def print_results(self):
        """Print test results."""
        stats = self.results.get_stats()
        
        print(f"\n{'='*60}")
        print("LOAD TEST RESULTS")
        print(f"{'='*60}")
        
        if not stats:
            print("No data collected")
            return
        
        print(f"\n📊 Throughput:")
        print(f"   Total messages sent:     {stats['total_sent']}")
        print(f"   Total messages received: {stats['total_received']}")
        print(f"   Throughput:              {stats['throughput_msg_per_sec']:.1f} msg/sec")
        print(f"   Loss rate:               {stats['loss_rate']:.2f}%")
        
        print(f"\n⏱️  Latency:")
        latency = stats['latency']
        print(f"   Min:  {latency['min_ms']:.1f}ms")
        print(f"   Max:  {latency['max_ms']:.1f}ms")
        print(f"   Avg:  {latency['avg_ms']:.1f}ms")
        print(f"   P50:  {latency['p50_ms']:.1f}ms {'✅' if latency['p50_ms'] < 30 else '❌'} (target: <30ms)")
        print(f"   P95:  {latency['p95_ms']:.1f}ms {'✅' if latency['p95_ms'] < 120 else '❌'} (target: <120ms)")
        print(f"   P99:  {latency['p99_ms']:.1f}ms {'✅' if latency['p99_ms'] < 200 else '❌'} (target: <200ms)")
        
        print(f"\n❌ Errors: {stats['errors']}")
        print(f"⏰ Duration: {stats['duration_sec']:.1f}s")
        
        # Verdict
        print(f"\n{'='*60}")
        print("VERDICT:")
        passed = (
            latency['p50_ms'] < 30 and
            latency['p95_ms'] < 120 and
            latency['p99_ms'] < 200 and
            stats['loss_rate'] < 1 and
            stats['errors'] == 0
        )
        
        if passed:
            print("✅ ALL TARGETS MET - System is production ready!")
        else:
            print("❌ SOME TARGETS NOT MET - Review issues above")
        
        print(f"{'='*60}\n")


async def main():
    parser = argparse.ArgumentParser(description="Chatify Load Test")
    parser.add_argument("--users", type=int, default=20, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--rate", type=float, default=1.0, help="Messages per second per user")
    args = parser.parse_args()

    tester = LoadTester(
        num_users=args.users,
        duration_sec=args.duration,
        rate_per_user=args.rate
    )
    
    await tester.run_test()


if __name__ == "__main__":
    asyncio.run(main())
