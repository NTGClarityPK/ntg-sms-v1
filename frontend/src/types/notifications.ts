export type NotificationType = 
  | 'attendance' 
  | 'leave' 
  | 'event' 
  | 'event_created'
  | 'event_updated'
  | 'grade' 
  | 'message'
  | 'assessment_read'
  | 'early_departure';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}



