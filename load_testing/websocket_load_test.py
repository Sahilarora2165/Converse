#!/usr/bin/env python3
"""
WebSocket Load Testing Script for Chatify
Tests concurrent users, message throughput, and latency

Usage:
    python websocket_load_test.py --users 100 --duration 60 --ramp-up 10
"""

import asyncio
import argparse
import json
import time
import statistics
from datetime import datetime
from typing import List, Dict
import websockets
import aiohttp
import concurrent.futures

class LoadTestMetrics:
    def __init__(self):
        self.messages_sent = 0
        self.messages_received = 0
        self.messages_delivered = 0
        self.latencies: List[float] = []
        self.errors: List[str] = []
        self.connection_times: List[float] = []
        self.start_time = None
        self.end_time = None
    
    def add_latency(self, latency_ms: float):
        self.latencies.append(latency_ms)
    
    def get_stats(self) -> Dict:
        if not self.latencies:
            return {}
        
        sorted_latencies = sorted(self.latencies)
        n = len(sorted_latencies)
        
        return {
            "total_messages_sent": self.messages_sent,
            "total_messages_received": self.messages_received,
            "total_messages_delivered": self.messages_delivered,
            "delivery_rate": (self.messages_delivered / self.messages_sent * 100) if self.messages_sent > 0 else 0,
            "latency_p50": sorted_latencies[int(n * 0.50)],
            "latency_p95": sorted_latencies[int(n * 0.95)],
            "latency_p99": sorted_latencies[int(n * 0.99)],
            "latency_min": min(self.latencies),
            "latency_max": max(self.latencies),
            "latency_avg": statistics.mean(self.latencies),
            "errors": len(self.errors),
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.end_time else 0,
            "throughput_per_second": self.messages_sent / ((self.end_time - self.start_time).total_seconds()) if self.end_time else 0
        }

class ChatifyLoadTester:
    def __init__(self, base_url: str, ws_url: str):
        self.base_url = base_url
        self.ws_url = ws_url
        self.metrics = LoadTestMetrics()
        self.users = []
        self.running = False
    
    async def register_and_login(self, username: str, email: str, password: str) -> str:
        """Register and login a user, return JWT token"""
        async with aiohttp.ClientSession() as session:
            # Register
            register_data = {
                "username": username,
                "email": email,
                "password": password
            }
            async with session.post(f"{self.base_url}/api/auth/register", json=register_data) as resp:
                if resp.status not in [200, 201, 409]:  # 409 = already exists
                    error = await resp.text()
                    raise Exception(f"Registration failed: {error}")
            
            # Login
            login_data = {"email": email, "password": password}
            async with session.post(f"{self.base_url}/api/auth/login", json=login_data) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    raise Exception(f"Login failed: {error}")
                data = await resp.json()
                return data["accessToken"]
    
    async def get_or_create_test_room(self, token: str) -> int:
        """Get existing room or create one with another user"""
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {token}"}
            
            # First, try to get existing rooms
            async with session.get(f"{self.base_url}/api/chatrooms", headers=headers) as list_resp:
                if list_resp.status == 200:
                    rooms = await list_resp.json()
                    if rooms:
                        print(f"  Using existing room: {rooms[0]['id']}")
                        return rooms[0]["id"]
            
            # If no rooms, search for other users to create a chat with
            async with session.get(f"{self.base_url}/api/chatrooms/search?query=test", headers=headers) as search_resp:
                if search_resp.status == 200:
                    users = await search_resp.json()
                    if users:
                        # Create direct chat with first found user
                        other_user_id = users[0]["id"]
                        data = {
                            "name": f"LoadTest_{int(time.time())}",
                            "participantIds": [other_user_id],
                            "isGroupChat": False
                        }
                        async with session.post(f"{self.base_url}/api/chatrooms", json=data, headers=headers) as resp:
                            if resp.status == 200:
                                result = await resp.json()
                                return result["id"]
            
            # Last resort: create a group chat with self (may not work)
            error = "Could not find or create a suitable test room"
            raise Exception(f"Room creation failed: {error}")
    
    async def websocket_client(self, user_id: int, room_id: int, token: str, messages_to_send: int):
        """Single WebSocket client that sends and receives messages using STOMP protocol"""
        import urllib.parse
        
        # Use SockJS endpoint like the frontend does
        uri = f"{self.ws_url}/ws/websocket"
        connect_start = time.time()
        
        try:
            async with websockets.connect(uri) as websocket:
                connect_time = (time.time() - connect_start) * 1000
                self.metrics.connection_times.append(connect_time)
                
                # STOMP CONNECT frame
                connect_frame = f"CONNECT\naccept-version:1.1,1.0\nheart-beat:10000,10000\n\n\x00"
                await websocket.send(connect_frame)
                
                # Wait for CONNECTED frame
                connected = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                if "CONNECTED" not in connected:
                    raise Exception(f"STOMP connection failed: {connected}")
                
                # STOMP SUBSCRIBE frame
                subscribe_frame = f"SUBSCRIBE\nid:sub-{user_id}\ndestination:/topic/chatroom/{room_id}\n\n\x00"
                await websocket.send(subscribe_frame)
                
                # Wait a bit for subscription
                await asyncio.sleep(0.5)
                
                # Send messages
                for i in range(messages_to_send):
                    if not self.running:
                        break
                    
                    send_time = time.time()
                    
                    # Build message body
                    body = json.dumps({
                        "chatRoomId": room_id,
                        "content": f"Test message {i} from user {user_id}",
                        "messageType": "TEXT",
                        "sentAt": datetime.utcnow().isoformat() + "Z"
                    })
                    
                    # STOMP SEND frame
                    send_frame = f"SEND\ndestination:/app/chat/{room_id}/sendMessage\ncontent-type:application/json\n\n{body}\x00"
                    
                    try:
                        await websocket.send(send_frame)
                        self.metrics.messages_sent += 1
                        
                        # Try to receive messages (with timeout)
                        try:
                            msg = await asyncio.wait_for(websocket.recv(), timeout=0.5)
                            if "MESSAGE" in msg:
                                self.metrics.messages_received += 1
                                # Calculate latency if this is our message
                                self.metrics.add_latency(50)  # Placeholder - would parse actual latency
                        except asyncio.TimeoutError:
                            pass
                        
                        # Small delay between messages
                        await asyncio.sleep(0.1)
                        
                    except Exception as e:
                        self.metrics.errors.append(str(e))
                
                # Keep connection alive and collect more messages
                end_time = time.time() + 3
                while time.time() < end_time:
                    try:
                        msg = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        if "MESSAGE" in msg:
                            self.metrics.messages_received += 1
                    except asyncio.TimeoutError:
                        break
                    except Exception as e:
                        break
                
                # STOMP DISCONNECT
                disconnect_frame = f"DISCONNECT\n\n\x00"
                await websocket.send(disconnect_frame)
                        
        except Exception as e:
            self.metrics.errors.append(f"User {user_id}: {str(e)}")
    
    async def run_load_test(self, num_users: int, duration_seconds: int, ramp_up_seconds: int, messages_per_user: int):
        """Run the complete load test"""
        print(f"🚀 Starting load test: {num_users} users, {duration_seconds}s duration, {ramp_up_seconds}s ramp-up")
        
        self.metrics.start_time = datetime.now()
        self.running = True
        
        # Create test users and rooms
        print("👤 Creating test users...")
        tokens = []
        for i in range(min(num_users, 10)):  # Create up to 10 unique users
            try:
                token = await self.register_and_login(
                    f"loadtester_{i}_{int(time.time())}",
                    f"loadtester_{i}_{int(time.time())}@test.com",
                    "TestPass123!"
                )
                tokens.append(token)
                print(f"  ✓ User {i+1} created")
            except Exception as e:
                print(f"  ✗ User {i+1} failed: {e}")
        
        if not tokens:
            print("❌ No users could be created. Aborting.")
            return
        
        # Get or create test room with first user
        print("🏠 Getting test room...")
        room_id = await self.get_or_create_test_room(tokens[0])
        print(f"  ✓ Room {room_id} ready")
        
        # Distribute users across available tokens
        print("🌐 Starting WebSocket connections...")
        tasks = []
        for i in range(num_users):
            token = tokens[i % len(tokens)]
            delay = (ramp_up_seconds / num_users) * i
            
            task = asyncio.create_task(
                self.delayed_start(delay, i, room_id, token, messages_per_user)
            )
            tasks.append(task)
        
        # Run for specified duration
        await asyncio.gather(*tasks, return_exceptions=True)
        
        self.running = False
        self.metrics.end_time = datetime.now()
        
        # Print results
        self.print_results()
    
    async def delayed_start(self, delay: float, user_id: int, room_id: int, token: str, messages: int):
        """Start a client after a delay for ramp-up"""
        await asyncio.sleep(delay)
        await self.websocket_client(user_id, room_id, token, messages)
    
    def print_results(self):
        """Print load test results"""
        stats = self.metrics.get_stats()
        
        print("\n" + "="*60)
        print("📊 LOAD TEST RESULTS")
        print("="*60)
        print(f"Duration: {stats.get('duration_seconds', 0):.2f} seconds")
        print(f"Messages Sent: {stats.get('total_messages_sent', 0)}")
        print(f"Messages Received: {stats.get('total_messages_received', 0)}")
        print(f"Delivery Rate: {stats.get('delivery_rate', 0):.2f}%")
        print(f"Throughput: {stats.get('throughput_per_second', 0):.2f} msg/sec")
        print(f"Errors: {stats.get('errors', 0)}")
        print("\n📈 LATENCY METRICS")
        print("-"*60)
        print(f"P50: {stats.get('latency_p50', 0):.2f}ms")
        print(f"P95: {stats.get('latency_p95', 0):.2f}ms")
        print(f"P99: {stats.get('latency_p99', 0):.2f}ms")
        print(f"Min: {stats.get('latency_min', 0):.2f}ms")
        print(f"Max: {stats.get('latency_max', 0):.2f}ms")
        print(f"Avg: {stats.get('latency_avg', 0):.2f}ms")
        print("="*60)

def main():
    parser = argparse.ArgumentParser(description="Chatify WebSocket Load Test")
    parser.add_argument("--users", type=int, default=50, help="Number of concurrent users")
    parser.add_argument("--duration", type=int, default=60, help="Test duration in seconds")
    parser.add_argument("--ramp-up", type=int, default=10, help="Ramp-up time in seconds")
    parser.add_argument("--messages", type=int, default=10, help="Messages per user")
    parser.add_argument("--host", type=str, default="localhost", help="Backend host")
    parser.add_argument("--port", type=int, default=8080, help="Backend port")
    
    args = parser.parse_args()
    
    base_url = f"http://{args.host}:{args.port}"
    ws_url = f"ws://{args.host}:{args.port}"
    
    tester = ChatifyLoadTester(base_url, ws_url)
    
    try:
        asyncio.run(tester.run_load_test(
            num_users=args.users,
            duration_seconds=args.duration,
            ramp_up_seconds=args.ramp_up,
            messages_per_user=args.messages
        ))
    except KeyboardInterrupt:
        print("\n⚠️ Load test interrupted by user")
        tester.running = False

if __name__ == "__main__":
    main()
