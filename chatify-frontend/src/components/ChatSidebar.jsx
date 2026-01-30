import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChatRooms } from "../services/api";

const ChatSidebar = ({ rooms, setRooms }) => {
  const navigate = useNavigate();
  const { chatId } = useParams();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await getChatRooms();
        setRooms(data);
      } catch (err) {
        console.error("Failed to load chat rooms", err);
      }
    };

    fetchRooms();
  }, [setRooms]);

  // Logic to separate rooms for a professional layout
  const channels = rooms.filter(room => room.isGroupChat);
  const directMessages = rooms.filter(room => !room.isGroupChat);

  return (
    <div className="w-1/4 bg-slate-900 text-slate-300 flex flex-col h-screen border-r border-slate-800">
      {/* Rebranded Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900">
        <h1 className="font-bold text-xl text-white tracking-wider">NEXUS</h1>
        <p className="text-[10px] text-slate-500 uppercase font-semibold mt-1">Engineering Hub</p>
      </div>

      <div className="overflow-y-auto flex-1 p-2 space-y-6">

        {/* CHANNELS SECTION */}
        <div>
          <div className="flex justify-between items-center px-2 mb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Channels</h2>
          </div>
          <div className="space-y-1">
            {channels.map(room => (
              <div
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}`)}
                className={`group flex items-center p-2 rounded cursor-pointer transition-colors
                  ${chatId === String(room.id)
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"}`}
              >
                <span className="mr-2 text-slate-500 group-hover:text-slate-300">#</span>
                <span className="truncate text-sm font-medium">{room.name}</span>
              </div>
            ))}
            {channels.length === 0 && (
              <p className="px-2 text-xs text-slate-600 italic">No channels joined</p>
            )}
          </div>
        </div>

        {/* DIRECT MESSAGES SECTION */}
        <div>
          <div className="flex justify-between items-center px-2 mb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Direct Messages</h2>
          </div>
          <div className="space-y-1">
            {directMessages.map(room => (
              <div
                key={room.id}
                onClick={() => navigate(`/chat/${room.id}`)}
                className={`flex items-center p-2 rounded cursor-pointer transition-colors
                  ${chatId === String(room.id)
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"}`}
              >
                <span className="mr-2 text-[10px] text-green-500">●</span>
                <span className="truncate text-sm font-medium">{room.name}</span>
              </div>
            ))}
            {directMessages.length === 0 && (
              <p className="px-2 text-xs text-slate-600 italic">No recent messages</p>
            )}
          </div>
        </div>

      </div>

      {/* Optional: User Profile / Settings Footer */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
         <button
           onClick={() => navigate('/chat')} // Or open the "New Chat" modal
           className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded transition-all"
         >
           + NEW COLLABORATION
         </button>
      </div>
    </div>
  );
};

export default ChatSidebar;