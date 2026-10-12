import { useEffect } from "react";
import { subscribeToNotifications, unreadCount } from "../data/api";
import { useLoad } from "./useLoad";

/** Unread notifications for the signed-in person, updated live when a new one arrives. */
export function useUnread(userId: string | undefined): number {
  useEffect(() => (userId ? subscribeToNotifications(userId) : undefined), [userId]);
  return useLoad(() => (userId ? unreadCount() : Promise.resolve(0)), [userId]) ?? 0;
}
