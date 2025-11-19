import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import SockJS from 'sockjs-client';
import Stomp from 'stompjs';

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

  useEffect(() => {
    // Create WebSocket connection
    const socket = new SockJS('http://localhost:8080/ws');
    const stompClient = Stomp.over(socket);
    
    // Disable debug logging
    stompClient.debug = () => {};

    stompClient.connect({}, 
      () => {
        console.log('WebSocket connected');
        setConnected(true);

        // Subscribe to updates topic
        stompClient.subscribe('/topic/updates', (message) => {
          const wsMessage: WebSocketMessage = JSON.parse(message.body);
          setLastMessage(wsMessage);
          console.log('Received message:', wsMessage);
        });
      },
      (error: any) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      }
    );

    // Cleanup on unmount
    return () => {
      if (stompClient.connected) {
        stompClient.disconnect(() => {
          console.log('WebSocket disconnected');
        });
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
}
