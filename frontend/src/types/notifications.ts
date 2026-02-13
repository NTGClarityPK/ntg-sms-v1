export type NotificationType = 
  | 'attendance' 
  | 'leave' 
  | 'leave_request_raised'
  | 'event' 
  | 'event_created'
  | 'event_updated'
  | 'event_consent_submitted'
  | 'grade' 
  | 'message'
  | 'assessment_read'
  | 'early_departure'
  | 'early_departure_request_raised'
  | 'early_departure_excused';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  isCritical?: boolean;
  createdAt: string;
}



