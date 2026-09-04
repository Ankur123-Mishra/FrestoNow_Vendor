import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ENV } from '@/config/env';
import { useAuthStore } from '@/store/authStore';

export const ROS_SOCKET_EVENTS = {
  ORDER_NEW: 'ros:order.new',
  BILL_REQUESTED: 'ros:bill.requested',
  ORDER_READY: 'ros:order.ready',
} as const;

export type RosOrderNewPayload = {
  vendorId: number;
  orderId: number;
  orderNumber?: string | null;
  channel?: string | null;
  tableCode?: string | null;
  tokenNumber?: number | null;
  reason?: 'created' | 'items_added' | string;
  at?: string;
};

export type RosBillRequestedPayload = {
  vendorId: number;
  tableId: number;
  tableCode?: string | null;
  orderId?: number | null;
  waiterId?: number | null;
  waiterName?: string | null;
  at?: string;
};

export type RosOrderReadyPayload = {
  vendorId: number;
  orderId: number;
  orderNumber?: string | null;
  channel?: string | null;
  tableId?: number | null;
  tableCode?: string | null;
  tokenNumber?: number | null;
  waiterId?: number | null;
  waiterName?: string | null;
  at?: string;
};

type Handlers = {
  onOrderNew?: (payload: RosOrderNewPayload) => void;
  onBillRequested?: (payload: RosBillRequestedPayload) => void;
  onOrderReady?: (payload: RosOrderReadyPayload) => void;
  enabled?: boolean;
};

/**
 * Connects to backend Socket.IO as the logged-in vendor and joins ROS role rooms.
 */
export function useRosSocket({
  onOrderNew,
  onBillRequested,
  onOrderReady,
  enabled = true,
}: Handlers) {
  const token = useAuthStore(s => s.token);
  const handlersRef = useRef({ onOrderNew, onBillRequested, onOrderReady });
  handlersRef.current = { onOrderNew, onBillRequested, onOrderReady };

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    const socket: Socket = io(ENV.SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1200,
      withCredentials: true,
    });

    const join = () => {
      socket.emit('ros:join', {}, (ack?: { ok?: boolean; error?: string }) => {
        if (ack && ack.ok === false) {
          console.warn('[ros] join failed', ack.error);
        }
      });
    };

    socket.on('connect', () => {
      console.info('[ros] socket connected', socket.id);
      join();
    });
    socket.on('connect_error', err => {
      console.warn('[ros] connect_error', err.message);
    });
    socket.on(ROS_SOCKET_EVENTS.ORDER_NEW, (payload: RosOrderNewPayload) => {
      handlersRef.current.onOrderNew?.(payload);
    });
    socket.on(ROS_SOCKET_EVENTS.BILL_REQUESTED, (payload: RosBillRequestedPayload) => {
      handlersRef.current.onBillRequested?.(payload);
    });
    socket.on(ROS_SOCKET_EVENTS.ORDER_READY, (payload: RosOrderReadyPayload) => {
      handlersRef.current.onOrderReady?.(payload);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, enabled]);
}
