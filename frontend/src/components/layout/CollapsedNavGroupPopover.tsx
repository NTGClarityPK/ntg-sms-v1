'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import {
  alpha,
  Box,
  Popover,
  Tooltip,
  UnstyledButton,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import type { IconProps } from '@tabler/icons-react';
import type { NavItem } from './nav-types';

/** Hover opens flyout only after this delay so quick cursor passes do not flash menus. */
const OPEN_DELAY_MS = 200;
/** Brief grace period so the pointer can leave the icon and enter the dropdown without closing. */
const CLOSE_DELAY_MS = 130;

const GROUP_TRIGGER_HEIGHT = 48;
const GROUP_ICON_SIZE = 20;
const FLYOUT_ICON_SIZE = 18;

function pathMatchesRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface FlyoutNavLinkProps {
  item: NavItem;
  label: string;
  active: boolean;
  defaultFg: string;
  hoverBg: string;
  hoverFg: string;
  navActiveBackground?: string;
  navActiveTextColor?: string;
  onPick: () => void;
}

/** Pointer-driven hover so theme colours are not lost to global CSS (`:hover` + !important fights). */
function FlyoutNavLink({
  item,
  label,
  active,
  defaultFg,
  hoverBg,
  hoverFg,
  navActiveBackground,
  navActiveTextColor,
  onPick,
}: FlyoutNavLinkProps) {
  const theme = useMantineTheme();
  const [hovered, setHovered] = useState(false);

  const backgroundColor = active
    ? navActiveBackground ?? 'transparent'
    : hovered
      ? hoverBg
      : 'transparent';

  const color = active
    ? navActiveTextColor ?? defaultFg
    : hovered
      ? hoverFg
      : defaultFg;

  return (
    <UnstyledButton
      id={`flyout-nav-${item.href.slice(1).replace(/\//g, '-')}`}
      type="button"
      className="nav-item-button"
      data-active={active}
      data-collapsed={false}
      aria-current={active ? 'page' : undefined}
      onClick={onPick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor,
        color,
        fontWeight: active ? 600 : 400,
      }}
      styles={{
        root: {
          borderRadius: theme.radius.sm,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          gap: theme.spacing.sm,
          transition: 'background-color 120ms ease, color 120ms ease',
        },
      }}
    >
      <Box component="span" style={{ display: 'inline-flex', lineHeight: 0 }}>
        <item.icon size={FLYOUT_ICON_SIZE} stroke={1.5} />
      </Box>
      <Box component="span" fz="sm" style={{ color: 'inherit' }}>
        {label}
      </Box>
    </UnstyledButton>
  );
}

/** Light navbar + white icon colour made inactive group icons invisible; flyout used dark[6] in all schemes. */
function useCollapsedRailPalette() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const primary =
    theme.colors[theme.primaryColor]?.[6] ??
    theme.colors[theme.primaryColor]?.[5] ??
    theme.colors.blue[6];

  return {
    isDark,
    primary,
    inactiveIcon: isDark ? alpha(theme.white, 0.65) : alpha(theme.black, 0.55),
    inactiveHoverBg: isDark ? alpha(theme.white, 0.06) : alpha(theme.black, 0.06),
    inactiveHoverIcon: isDark ? alpha(theme.white, 0.92) : alpha(theme.black, 0.82),
    flyoutBg: isDark ? theme.colors.dark[6] : theme.white,
    flyoutBorder: isDark ? alpha(theme.white, 0.12) : theme.colors.gray[3],
    flyoutItem: isDark ? theme.colors.gray[1] : theme.colors.dark[7],
    flyoutMuted: isDark ? theme.colors.gray[3] : theme.colors.gray[6],
    flyoutHoverBg: isDark ? alpha(theme.white, 0.06) : alpha(theme.black, 0.04),
  };
}

export interface CollapsedNavGroupPopoverProps {
  groupId: string;
  groupLabel: string;
  GroupIcon: React.ComponentType<IconProps>;
  items: NavItem[];
  opened: boolean;
  onOpenChange: (open: boolean) => void;
  /** `true` = desktop-style hover with delay; `false` = tap to open (mobile / coarse pointer). */
  useHoverInteraction: boolean;
  getItemLabel: (key: string) => string;
  onNavigate?: () => void;
  /** Match expanded sidebar nav hover (from theme navbar config). */
  navHoverBackground?: string;
  navHoverColor?: string;
  navActiveBackground?: string;
  navActiveTextColor?: string;
  /** Default label colour (navbar text); row bg stays transparent until hover or active. */
  navDefaultTextColor?: string;
}

export function CollapsedNavGroupPopover({
  groupId,
  groupLabel,
  GroupIcon,
  items,
  opened,
  onOpenChange,
  useHoverInteraction,
  getItemLabel,
  onNavigate,
  navHoverBackground,
  navHoverColor,
  navActiveBackground,
  navActiveTextColor,
  navDefaultTextColor,
}: CollapsedNavGroupPopoverProps) {
  const theme = useMantineTheme();
  const palette = useCollapsedRailPalette();
  const router = useRouter();
  const pathname = usePathname();
  const isRtl = useLocale() === 'ar';

  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback((ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  }, []);

  /** Any child route active → highlight parent group icon (e.g. /students/xyz). */
  const isGroupActive = items.some((it) => pathMatchesRoute(pathname, it.href));

  const requestOpen = useCallback(() => {
    clearTimer(closeTimerRef);
    clearTimer(openTimerRef);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      onOpenChange(true);
    }, OPEN_DELAY_MS);
  }, [clearTimer, onOpenChange]);

  const requestClose = useCallback(() => {
    clearTimer(openTimerRef);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onOpenChange(false);
    }, CLOSE_DELAY_MS);
  }, [clearTimer, onOpenChange]);

  const cancelScheduledOpen = useCallback(() => {
    clearTimer(openTimerRef);
  }, [clearTimer]);

  const holdOpen = useCallback(() => {
    clearTimer(closeTimerRef);
  }, [clearTimer]);

  const closeNow = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(closeTimerRef);
    onOpenChange(false);
  }, [clearTimer, onOpenChange]);

  useEffect(
    () => () => {
      clearTimer(openTimerRef);
      clearTimer(closeTimerRef);
    },
    [clearTimer],
  );

  /** Close flyout when user scrolls (sidebar or page) so the menu does not float detached. */
  useEffect(() => {
    if (!opened) return;
    const onScroll = () => closeNow();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [opened, closeNow]);

  const flyoutPosition = isRtl ? 'left-start' : 'right-start';

  /** Inactive: must contrast with light navbar (do not use white). Active: `data-active` + `.nav-item-button` in DynamicThemeProvider. */
  const triggerVariantStyles = !isGroupActive
    ? {
        backgroundColor: 'transparent',
        color: palette.inactiveIcon,
      }
    : {};

  const onTargetClick = () => {
    if (useHoverInteraction) return;
    onOpenChange(!opened);
  };

  const tooltipSide = isRtl ? 'left' : 'right';

  const triggerButton = (
    <UnstyledButton
      className="nav-item-button"
      id={`collapsed-nav-group-${groupId}`}
      type="button"
      aria-haspopup="true"
      aria-expanded={opened}
      aria-label={groupLabel}
      data-active={isGroupActive}
      data-collapsed
      onClick={onTargetClick}
      onMouseEnter={() => {
        if (!useHoverInteraction) return;
        requestOpen();
      }}
      onMouseLeave={() => {
        if (!useHoverInteraction) return;
        cancelScheduledOpen();
        requestClose();
      }}
      styles={{
        root: {
          position: 'relative',
          width: '100%',
          height: GROUP_TRIGGER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.sm,
          transition: 'background-color 120ms ease, color 120ms ease',
          ...triggerVariantStyles,
          ...(!isGroupActive
            ? {
                '&:hover': {
                  backgroundColor: palette.inactiveHoverBg,
                  color: palette.inactiveHoverIcon,
                },
              }
            : {}),
        },
      }}
    >
      <GroupIcon size={GROUP_ICON_SIZE} stroke={1.5} />
    </UnstyledButton>
  );

  return (
    <Popover
      position={flyoutPosition}
      offset={8}
      withArrow
      arrowSize={10}
      shadow="md"
      radius="sm"
      trapFocus={false}
      returnFocus={false}
      closeOnEscape
      closeOnClickOutside
      withinPortal
      zIndex={400}
      opened={opened}
      onChange={onOpenChange}
      onDismiss={() => onOpenChange(false)}
      styles={{
        dropdown: {
          minWidth: 220,
          padding: 8,
          backgroundColor: palette.flyoutBg,
          border: `1px solid ${palette.flyoutBorder}`,
        },
      }}
    >
      <Popover.Target>
        <Tooltip
          label={groupLabel}
          position={tooltipSide}
          withArrow
          disabled={opened}
          openDelay={400}
        >
          {triggerButton}
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown
        onMouseEnter={() => {
          if (!useHoverInteraction) return;
          holdOpen();
        }}
        onMouseLeave={() => {
          if (!useHoverInteraction) return;
          requestClose();
        }}
      >
        <Box
          component="nav"
          aria-label={groupLabel}
          style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          {items.map((item) => {
            const active = pathMatchesRoute(pathname, item.href);
            const defaultFg = navDefaultTextColor ?? palette.flyoutItem;
            const hoverBg = navHoverBackground ?? palette.flyoutHoverBg;
            const hoverFg = navHoverColor ?? defaultFg;
            return (
              <FlyoutNavLink
                key={item.href}
                item={item}
                label={getItemLabel(item.key)}
                active={active}
                defaultFg={defaultFg}
                hoverBg={hoverBg}
                hoverFg={hoverFg}
                navActiveBackground={navActiveBackground}
                navActiveTextColor={navActiveTextColor}
                onPick={() => {
                  router.push(item.href);
                  onOpenChange(false);
                  onNavigate?.();
                }}
              />
            );
          })}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}

export interface CollapsedNavDashboardButtonProps {
  item: NavItem;
  label: string;
  onNavigate?: () => void;
}

/** Standalone Dashboard icon — same dimensions as group triggers, no flyout or chevron badge. */
export function CollapsedNavDashboardButton({
  item,
  label,
  onNavigate,
}: CollapsedNavDashboardButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useMantineTheme();
  const palette = useCollapsedRailPalette();
  const isRtl = useLocale() === 'ar';

  const active = pathMatchesRoute(pathname, item.href);
  const tooltipSide = isRtl ? 'left' : 'right';

  const base = active
    ? {
        backgroundColor: alpha(palette.primary, 0.12),
        color: palette.primary,
        borderInlineStart: isRtl ? undefined : `3px solid ${palette.primary}`,
        borderInlineEnd: isRtl ? `3px solid ${palette.primary}` : undefined,
      }
    : {
        backgroundColor: 'transparent',
        color: palette.inactiveIcon,
      };

  return (
    <Tooltip label={label} position={tooltipSide} withArrow>
      <UnstyledButton
        className="nav-item-button"
        id={`nav-link-${item.href.slice(1).replace(/\//g, '-')}`}
        type="button"
        aria-label={label}
        data-active={active}
        data-collapsed={true}
        onClick={() => {
          router.push(item.href);
          onNavigate?.();
        }}
        styles={{
          root: {
            position: 'relative',
            width: '100%',
            height: GROUP_TRIGGER_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.radius.sm,
            transition: 'background-color 120ms ease, color 120ms ease',
            ...base,
            '&:hover': {
              backgroundColor: active
                ? alpha(palette.primary, 0.16)
                : palette.inactiveHoverBg,
              color: active ? palette.primary : palette.inactiveHoverIcon,
            },
          },
        }}
      >
        <item.icon size={GROUP_ICON_SIZE} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  );
}
