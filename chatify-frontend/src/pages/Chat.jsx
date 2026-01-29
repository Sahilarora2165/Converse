import React, { useState, useEffect, useRef } from 'react';
import useAuth from '../hooks/useAuth';
import useWebSocket from '../hooks/useWebSocket';
import { getChatRooms, getChatHistory } from '../services/api';
import { sendMessageAPI } from '../services/api';
import NewChatModal from '../components/NewChatModal';

const Chat = () => {
    const { user, logout } = useAuth();
    const { subscribeToRoom, sendMessage, isConnected } = useWebSocket();

    // State
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    // Refs
    const messagesEndRef = useRef(null);
    const subscriptionRef = useRef(null);

    // 1. Load Chat Rooms on startup
    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const { data } = await getChatRooms();
            setRooms(data);
        } catch (err) {
            console.error("Failed to fetch rooms", err);
        }
    };

    // 2. Handle Room Selection
    const handleRoomSelect = async (room) => {
        if (currentRoom?.id === room.id) return; // Don't re-join same room

        // Cleanup old subscription
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
        }

        setCurrentRoom(room);
        setMessages([]); // Clear old messages immediately

        try {
            // A. Load History
            const { data } = await getChatHistory(room.id);
            setMessages(data);

            // B. Subscribe to Real-time Updates via WebSocket
            if (isConnected) {
                const sub = subscribeToRoom(room.id, (incomingMsg) => {
                    setMessages((prev) => [...prev, incomingMsg]);
                });
                subscriptionRef.current = sub;
            }
        } catch (err) {
            console.error("Error loading room details", err);
        }
    };

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 3. Send Message
    const handleSend = async (e) => {
            e.preventDefault();
            if (!newMessage.trim() || !currentRoom) return;

            try {
                // 1. Prepare the data matching your Java SendMessageDTO
                const messagePayload = {
                    content: newMessage,
                    chatRoomId: currentRoom.id,
                    messageType: "TEXT"
                };

                // 2. Send via REST API
                const response = await sendMessageAPI(messagePayload);

                // 3. Clear input immediately
                setNewMessage("");

                // Note: We don't manually add the message to the list yet.
                // We rely on the WebSocket to "echo" it back to us so we know it was delivered.

            } catch (error) {
                console.error("Failed to send message:", error);
                alert("Failed to send message");
            }
        };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* --- LEFT SIDEBAR (Rooms) --- */}
            <div className="w-1/4 bg-white border-r flex flex-col">
                <div className="p-4 border-b bg-blue-600 text-white flex justify-between items-center">
                    <h1 className="font-bold text-lg">Chatify</h1>
                    <div className="flex gap-2">
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                className="bg-blue-500 hover:bg-blue-400 p-1 rounded w-8 h-8 flex items-center justify-center"
                                title="New Chat"
                            >
                                +
                            </button>
                            <button onClick={logout} className="text-sm bg-blue-800 px-2 py-1 rounded">Logout</button>
                        </div>
                    <button onClick={logout} className="text-sm bg-blue-800 px-2 py-1 rounded">Logout</button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {rooms.map(room => (
                        <div
                            key={room.id}
                            onClick={() => handleRoomSelect(room)}
                            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition
                                ${currentRoom?.id === room.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                        >
                            <div className="font-bold text-gray-800">{room.name || "Chat Room"}</div>
                            <div className="text-xs text-gray-500">ID: {room.id} • {room.isGroupChat ? "Group" : "Private"}</div>
                        </div>
                    ))}
                    {rooms.length === 0 && (
                        <div className="p-4 text-gray-500 text-center text-sm">No conversations yet.</div>
                    )}
                </div>
            </div>

            {/* --- RIGHT CHAT AREA --- */}
            <div className="flex-1 flex flex-col">
                {currentRoom ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b bg-white shadow-sm flex justify-between items-center">
                            <h2 className="font-bold text-lg">{currentRoom.name}</h2>
                            <span className={`text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isConnected ? 'Online' : 'Reconnecting...'}
                            </span>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, index) => {
                                const isMe = msg.senderId === user.id; // Or compare email depending on your user object
                                return (
                                    <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? 'bg-blue-500 text-white' : 'bg-white border text-gray-800'}`}>
                                            {!isMe && <div className="text-xs font-bold mb-1 text-gray-400">{msg.senderEmail}</div>}
                                            <div>{msg.content}</div>
                                            <div className={`text-[10px] text-right mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
                            <input
                                type="text"
                                className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Type a message..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                                disabled={!isConnected}
                            >
                                ➤
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
                        <div className="text-6xl mb-4">💬</div>
                        <p>Select a conversation to start chatting</p>
                    </div>
                )}
            </div>
            {showNewChatModal && (
                    <NewChatModal
                        onClose={() => setShowNewChatModal(false)}
                        onChatCreated={(newRoom) => {
                        setRooms(prev => [newRoom, ...prev]);
                        setCurrentRoom(newRoom);
                    }}
                />
            )}
        </div>
    );
};

export default Chat;