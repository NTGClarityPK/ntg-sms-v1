'use client';

import { SimpleGrid, Stack, Text } from '@mantine/core';
import type { DashboardWidget } from '@/types/dashboard';
import { WidgetContainer } from './WidgetContainer';

export interface DashboardGridProps {
  widgets: DashboardWidget[];
  /** Map widget id to React node (the widget content). If missing, widget is skipped. */
  renderWidget: (widget: DashboardWidget) => React.ReactNode;
  /** Optional: order by preference; otherwise use API order */
  widgetIdsOrder?: string[];
}

export function DashboardGrid({
  widgets,
  renderWidget,
  widgetIdsOrder,
}: DashboardGridProps) {
  const ordered = widgetIdsOrder?.length
    ? [...widgets].sort(
        (a, b) =>
          (widgetIdsOrder.indexOf(a.id) === -1 ? 999 : widgetIdsOrder.indexOf(a.id)) -
          (widgetIdsOrder.indexOf(b.id) === -1 ? 999 : widgetIdsOrder.indexOf(b.id)),
      )
    : widgets;

  if (ordered.length === 0) {
    return (
      <Stack gap="md">
        <Text c="dimmed" size="sm">
          No widgets available for your role. Check back later or contact your administrator.
        </Text>
      </Stack>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {ordered.map((widget) => (
        <div key={widget.id}>{renderWidget(widget)}</div>
      ))}
    </SimpleGrid>
  );
}
