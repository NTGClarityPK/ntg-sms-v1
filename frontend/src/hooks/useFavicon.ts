'use client';

import { useEffect } from 'react';
import { useTenantBrandingStore } from '@/lib/store/tenant-branding-store';

const DEFAULT_FAVICON_HREF = '/ntg-logo.svg';

/**
 * Updates the document favicon based on tenant logo.
 * When the user is in a tenant context with a logo URL, the favicon is set from that image (resized to 32x32).
 * Otherwise the default NTG logo is used.
 */
export function useFavicon() {
  const { logoUrl } = useTenantBrandingStore();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const DYNAMIC_FAVICON_ATTR = 'data-dynamic-favicon';

    const removeExistingFavicons = () => {
      document.querySelectorAll(`link[rel*="icon"][${DYNAMIC_FAVICON_ATTR}]`).forEach((link) => {
        if (link.parentNode) link.parentNode.removeChild(link);
      });
    };

    const setDefaultFavicon = () => {
      removeExistingFavicons();
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = DEFAULT_FAVICON_HREF;
      link.setAttribute(DYNAMIC_FAVICON_ATTR, 'true');
      document.head.insertBefore(link, document.head.firstChild);
    };

    const setFaviconFromUrl = (url: string, type: string = 'image/png') => {
      removeExistingFavicons();
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = type;
      const separator = url.includes('?') ? '&' : '?';
      link.href = url.startsWith('data:') ? url : `${url}${separator}_fav=${Date.now()}`;
      link.setAttribute(DYNAMIC_FAVICON_ATTR, 'true');
      document.head.insertBefore(link, document.head.firstChild);
    };

    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 32, 32);
            const scale = Math.min(32 / img.width, 32 / img.height);
            const x = (32 - img.width * scale) / 2;
            const y = (32 - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            const dataUrl = canvas.toDataURL('image/png');
            setFaviconFromUrl(dataUrl);
          } else {
            setFaviconFromUrl(logoUrl, 'image/png');
          }
        } catch {
          setFaviconFromUrl(logoUrl, 'image/png');
        }
      };
      img.onerror = () => {
        setFaviconFromUrl(logoUrl, 'image/png');
      };
      img.src = logoUrl;
    } else {
      setDefaultFavicon();
    }
  }, [logoUrl]);
}
