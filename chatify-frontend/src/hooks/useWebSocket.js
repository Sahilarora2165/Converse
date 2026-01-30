import { useContext } from 'react';
import { WebSocketContext } from '../context/WebSocketContext';

const useWebSocket = () => {
    return useContext(WebSocketContext);
};

export default useWebSocket;