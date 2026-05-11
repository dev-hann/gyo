export interface NotificationInfo {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
  category: string;
}

export interface ListResult {
  notifications: NotificationInfo[];
  count: number;
}
