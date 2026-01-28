export class NotificationDto {
  id!: string;
  userId!: string;
  type!: string;
  title!: string;
  body?: string;
  data?: Record<string, unknown>;
  isRead!: boolean;
  createdAt!: string;

  constructor(partial: Partial<NotificationDto>) {
    Object.assign(this, partial);
  }
}



