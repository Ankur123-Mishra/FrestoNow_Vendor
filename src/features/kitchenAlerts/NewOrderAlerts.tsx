import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { IncomingOrderModal } from '@/components/orders/IncomingOrderModal';
import { orderService } from '@/api/services';
import {
  useRosSocket,
  type RosOrderNewPayload,
} from '@/hooks/useRosSocket';
import { useAuthStore } from '@/store/authStore';
import { useModuleStore } from '@/store/moduleStore';
import { asArray, getErrorMessage, getEntityId, unwrapPayload } from '@/utils/apiHelpers';
import { pickString } from '@/utils/format';
import {
  isKitchenBellMuted,
  releaseKitchenBell,
  setKitchenBellMuted,
  startKitchenBell,
  stopKitchenBell,
} from '@/utils/kitchenBell';
import { unwrapOrder } from '@/utils/order';
import type { Order } from '@/types';

type QueueItem = { orderId: number | string; reason?: string };

function toOrderId(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return null;
}

function orderKey(id: number | string) {
  return String(id);
}

/**
 * Incoming food orders (delivery / takeaway / dine-in table):
 * looping ringtone + partner-style accept / reject popup.
 */
export function NewOrderAlerts() {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const activeModule = useModuleStore(s => s.activeModule);
  const knownIds = useRef<Set<string> | null>(null);
  const seenPending = useRef<Set<string>>(new Set());
  const lastEventKey = useRef('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState<Order[]>([]);
  const [liveOrder, setLiveOrder] = useState<Order | null>(null);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const showAlerts = Boolean(token) && activeModule === 'FOOD';
  const current = queue[0] ?? null;
  const shopName = pickString(user?.shopname, user?.name, 'Restaurant');

  const remember = useCallback((key: string) => {
    if (lastEventKey.current === key) {
      return false;
    }
    lastEventKey.current = key;
    return true;
  }, []);

  const enqueue = useCallback((orderId: number | string, reason?: string) => {
    setQueue(prev => {
      if (prev.some(item => orderKey(item.orderId) === orderKey(orderId))) {
        return prev.map(item =>
          orderKey(item.orderId) === orderKey(orderId)
            ? { ...item, reason: reason ?? item.reason }
            : item,
        );
      }
      return [...prev, { orderId, reason }];
    });
    setMuted(false);
    setKitchenBellMuted(false);
    startKitchenBell();
  }, []);

  const dropCurrent = useCallback(() => {
    if (!current) {
      return;
    }
    setQueue(prev => prev.filter(item => orderKey(item.orderId) !== orderKey(current.orderId)));
    setActionError(null);
  }, [current]);

  const fetchPending = useCallback(async () => {
    if (!showAlerts) {
      return;
    }
    try {
      const res = await orderService.getAll({ status: 'PENDING', limit: 40 });
      const list = asArray<Order>(unwrapPayload(res.data)).filter(
        order => String(order.status || '').toUpperCase() === 'PENDING',
      );
      setPending(list);
    } catch (error) {
      console.warn('[NewOrderAlerts] pending poll failed', getErrorMessage(error));
    }
  }, [showAlerts]);

  const pulseOrder = useCallback(
    (payload: RosOrderNewPayload) => {
      if (payload.at) {
        const key = `order:${payload.orderId}:${payload.reason || 'created'}:${payload.at}`;
        if (!remember(key)) {
          return;
        }
      }
      if (knownIds.current) {
        knownIds.current.add(orderKey(payload.orderId));
      }
      enqueue(payload.orderId, payload.reason);
      void fetchPending();
    },
    [enqueue, fetchPending, remember],
  );

  useRosSocket({
    enabled: showAlerts,
    onOrderNew: pulseOrder,
  });

  useEffect(() => {
    if (!showAlerts) {
      knownIds.current = null;
      seenPending.current = new Set();
      setQueue([]);
      setPending([]);
      setLiveOrder(null);
      stopKitchenBell();
      return;
    }

    void fetchPending();
    const intervalMs = current ? 4000 : 8000;
    const timer = setInterval(() => {
      void fetchPending();
    }, intervalMs);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void fetchPending();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [showAlerts, current, fetchPending]);

  useEffect(() => {
    if (!showAlerts) {
      return;
    }
    const ids = new Set(
      pending
        .map(order => toOrderId(getEntityId(order) ?? order.id))
        .filter((id): id is number | string => id != null)
        .map(orderKey),
    );

    if (knownIds.current == null) {
      knownIds.current = ids;
      for (const order of pending) {
        const id = toOrderId(getEntityId(order) ?? order.id);
        if (id != null) {
          enqueue(id, 'created');
        }
      }
      return;
    }

    const fresh = pending.filter(order => {
      const id = toOrderId(getEntityId(order) ?? order.id);
      return id != null && !knownIds.current!.has(orderKey(id));
    });
    knownIds.current = ids;
    for (const order of fresh) {
      const id = toOrderId(getEntityId(order) ?? order.id);
      if (id != null) {
        enqueue(id, 'created');
      }
    }
  }, [pending, showAlerts, enqueue]);

  useEffect(() => {
    for (const order of pending) {
      const id = toOrderId(getEntityId(order) ?? order.id);
      if (id != null) {
        seenPending.current.add(orderKey(id));
      }
    }
    const pendingIds = new Set(
      pending
        .map(order => toOrderId(getEntityId(order) ?? order.id))
        .filter((id): id is number | string => id != null)
        .map(orderKey),
    );
    setQueue(prev =>
      prev.filter(
        item =>
          pendingIds.has(orderKey(item.orderId)) ||
          !seenPending.current.has(orderKey(item.orderId)),
      ),
    );
  }, [pending]);

  useEffect(() => {
    if (!current) {
      stopKitchenBell();
      setLiveOrder(null);
      return;
    }

    startKitchenBell();

    const fromList =
      pending.find(order => orderKey(getEntityId(order) ?? order.id ?? '') === orderKey(current.orderId)) ??
      null;
    if (fromList) {
      setLiveOrder(fromList);
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await orderService.getById(current.orderId);
        const next = unwrapOrder(res.data);
        if (!cancelled && next) {
          setLiveOrder(next);
        }
      } catch {
        /* keep list snapshot if detail fails */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current, pending]);

  useEffect(() => {
    return () => {
      releaseKitchenBell();
    };
  }, []);

  const runKitchen = async (
    action: 'ACCEPT' | 'REJECT',
    note?: string,
    prepTimeMins?: number,
  ) => {
    if (!current) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await orderService.transitionStatus(
        current.orderId,
        action,
        note,
        prepTimeMins != null ? { prepTimeMins } : undefined,
      );
      dropCurrent();
      await fetchPending();
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not update the order'));
    } finally {
      setBusy(false);
    }
  };

  if (!showAlerts || !current) {
    return null;
  }

  return (
    <IncomingOrderModal
      order={liveOrder}
      queueCount={queue.length}
      shopName={shopName}
      reason={current.reason}
      muted={muted}
      busy={busy}
      error={actionError}
      onMuteToggle={() => {
        const next = !isKitchenBellMuted();
        setKitchenBellMuted(next);
        setMuted(next);
        if (!next) {
          startKitchenBell();
        }
      }}
      onDismiss={() => {
        stopKitchenBell();
        dropCurrent();
      }}
      onAccept={prepMins => {
        void runKitchen('ACCEPT', `Kitchen accepted; ETA ${prepMins} minutes`, prepMins);
      }}
      onReject={reason => {
        void runKitchen('REJECT', reason);
      }}
    />
  );
}
