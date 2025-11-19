import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import SockJS from 'sockjs-client';
import { Client, Message } from 'stompjs';
import { toast } from '../components/ui/Toast';

interface WebSocketMessage {
  type: string;
  message: string;
  data: any;
  timestamp: string;
}

interface WebSocketContextType {
  connected: boolean;
  lastMessage: WebSocketMessage | null;
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  lastMessage: null,
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    // Create WebSocket connection
    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = new Client();
    
    stompClient.webSocketFactory = () => socket as any;

    stompClient.onConnect = () => {
      console.log('WebSocket connected');
      setConnected(true);

      // Subscribe to updates topic
      stompClient.subscribe('/topic/updates', (message: Message) => {
        const wsMessage: WebSocketMessage = JSON.parse(message.body);
        setLastMessage(wsMessage);
        handleMessage(wsMessage);
      });
    };

    stompClient.onDisconnect = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    };

    stompClient.onStompError = (frame) => {
      console.error('WebSocket error:', frame);
      setConnected(false);
    };

    stompClient.activate();
    setClient(stompClient);

    // Cleanup on unmount
    return () => {
      if (stompClient.active) {
        stompClient.deactivate();
      }
    };
  }, []);

  const handleMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'NOTIFICATION':
        toast.info(message.message);
        break;
      case 'UPDATE':
        toast.success(message.message);
        break;
      case 'ALERT':
        toast.warning(message.message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  };

  return (
    <WebSocketContext.Provider value={{ connected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}
