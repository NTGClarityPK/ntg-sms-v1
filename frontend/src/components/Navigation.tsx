'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const links = [
  { href: '/home', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

export function Navigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/home" className="flex items-center space-x-2">
            <div className="relative h-10 w-10 shrink-0">
              <Image src="/alma_logo-dark.svg" alt="NTG Alma Logo" fill className="object-contain" sizes="40px" />
            </div>
            <span className="bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text font-heading text-2xl text-transparent">
              NTG Alma
            </span>
          </Link>

          <div className="hidden items-center space-x-8 md:flex">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={
                    active
                      ? 'font-bold text-brand-green'
                      : 'font-medium text-gray-700 transition hover:text-brand-green'
                  }
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-6 py-2.5 font-semibold text-white transition hover:scale-105 hover:shadow-lg md:inline-block"
            >
              Login
            </Link>

            <button
              type="button"
              className="inline-flex rounded-lg p-2 text-gray-700 md:hidden"
              aria-expanded={open}
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 md:hidden">
            {links.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={
                    active ? 'font-bold text-brand-green' : 'font-medium text-gray-700 hover:text-brand-green'
                  }
                >
                  {label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-gradient-to-r from-brand-green to-brand-green-light px-6 py-2.5 text-center font-semibold text-white"
            >
              Login
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
