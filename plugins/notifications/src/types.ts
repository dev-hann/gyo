export interface NotificationListenerStatus {
  /** True once the user has allowed notification access in the system settings and the listener is connected. */
  enabled: boolean;
}

export interface NotificationInfo {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
  category: string;
  /** The id the posting app gave the notification. */
  id: number;
}

export interface NotificationListResult {
  notifications: NotificationInfo[];
  count: number;
}

export interface ListResult {
  notifications: NotificationInfo[];
  count: number;
}
