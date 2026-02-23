export class DashboardWidgetDto {
  id!: string;
  title!: string;
  description?: string;
  role!: string;

  constructor(partial: Partial<DashboardWidgetDto>) {
    Object.assign(this, partial);
  }
}
