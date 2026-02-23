import { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '@/lib/api/orders';

/**
 * Hook to calculate and display order timer
 * Timer runs while order is in pending, preparing, or ready status
 * Timer stops when order status becomes served, completed, or cancelled
 * Also checks item statuses - if all items are served, timer stops
 * 
 * @param order - The order object
 * @param updateInterval - How often to update the timer display (default: 1000ms = 1 second)
 * @returns Object with elapsed time in milliseconds and formatted display string
 */
export function useOrderTimer(order: Order | null, updateInterval: number = 1000) {
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const stoppedAtRef = useRef<Date | null>(null);
  const prevOrderIdRef = useRef<string | null>(null);
  const isStoppedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!order) {
      setElapsedTime(0);
      setIsStopped(false);
      stoppedAtRef.current = null;
      prevOrderIdRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Check if order changed (new order or order updated)
    const orderChanged = prevOrderIdRef.current !== order.id;
    if (orderChanged) {
      prevOrderIdRef.current = order.id;
      // Reset stopped state when order changes
      setIsStopped(false);
      stoppedAtRef.current = null;
    }

    // Check if timer should be stopped based on order status
    const shouldStop = (orderStatus: OrderStatus): boolean => {
      return orderStatus === 'served' || orderStatus === 'completed' || orderStatus === 'cancelled';
    };

    // Check if all items are served (if order has items)
    const allItemsServed = (): boolean => {
      if (!order.items || order.items.length === 0) {
        return false; // No items, check order status only
      }
      
      // Filter out buffet items (they don't have status)
      const nonBuffetItems = order.items.filter(item => !item.buffetId && !item.buffet);
      
      if (nonBuffetItems.length === 0) {
        return false; // Only buffet items, check order status only
      }
      
      // Check if all non-buffet items are served
      return nonBuffetItems.every(item => {
        const itemStatus = item.status || 'preparing';
        return itemStatus === 'served';
      });
    };

    const orderStatus = order.status;
    const itemsAllServed = allItemsServed();
    const timerShouldStop = shouldStop(orderStatus) || itemsAllServed;

    // If timer should stop
    if (timerShouldStop) {
      // Only update state if not already stopped (to avoid unnecessary re-renders)
      if (!isStoppedRef.current) {
        setIsStopped(true);
        isStoppedRef.current = true;
        // Record when it stopped (use order's updatedAt if available, otherwise current time)
        stoppedAtRef.current = order.updatedAt ? new Date(order.updatedAt) : new Date();
      }
      
      // Calculate final elapsed time
      // For scheduled orders that are preparing/ready/served, use placedAt (which gets reset when moving to preparing)
      // If placedAt is null, fall back to updatedAt (when status changed to preparing)
      // For other orders, use orderDate
      const timerStartDate = (order.scheduledFor && order.status !== 'pending') 
        ? (order.placedAt || order.updatedAt || order.orderDate)
        : order.orderDate;
      const orderDate = new Date(timerStartDate);
      const stopTime = stoppedAtRef.current || new Date();
      const finalElapsed = stopTime.getTime() - orderDate.getTime();
      setElapsedTime(Math.max(0, finalElapsed));
      
      // Clear interval if running
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Timer should run
    // Only update state if currently stopped (to avoid unnecessary re-renders)
    if (isStoppedRef.current) {
      setIsStopped(false);
      isStoppedRef.current = false;
      stoppedAtRef.current = null;
    }
    
    // For scheduled orders that are preparing/ready/served, use placedAt (which gets reset when moving to preparing)
    // If placedAt is null, fall back to updatedAt (when status changed to preparing)
    // For other orders, use orderDate
    const timerStartDate = (order.scheduledFor && order.status !== 'pending') 
      ? (order.placedAt || order.updatedAt || order.orderDate)
      : order.orderDate;
    
    // Calculate initial elapsed time
    const orderDate = new Date(timerStartDate);
    const now = new Date();
    const initialElapsed = now.getTime() - orderDate.getTime();
    setElapsedTime(Math.max(0, initialElapsed));

    // Set up interval to update timer (only if not already running)
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        setElapsedTime((prev) => {
          const timerStartDate = (order.scheduledFor && order.status !== 'pending') 
            ? (order.placedAt || order.updatedAt || order.orderDate)
            : order.orderDate;
          const orderDate = new Date(timerStartDate);
          const now = new Date();
          const elapsed = now.getTime() - orderDate.getTime();
          return Math.max(0, elapsed);
        });
      }, updateInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [order, updateInterval]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Format elapsed time as MM:SS or HH:MM:SS
  const formatElapsedTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    elapsedTime,
    elapsedTimeFormatted: formatElapsedTime(elapsedTime),
    isStopped,
  };
}

