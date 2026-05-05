import type { ReactNode } from 'react';

export type AlmaFrameVariant = 'green' | 'burgundy' | 'gray';

export function AlmaFrame({ variant, children }: { variant: AlmaFrameVariant; children: ReactNode }) {
  return (
    <div className="relative">
      {variant === 'green' && (
        <>
          <div className="absolute -inset-8 rounded-[3.5rem] bg-gradient-to-br from-brand-green to-brand-green-light opacity-10" />
          <div className="absolute -inset-2 rounded-[3rem] bg-gradient-to-br from-brand-green to-brand-green-light opacity-15" />
        </>
      )}
      {variant === 'burgundy' && (
        <>
          <div className="absolute -inset-8 rounded-[3.5rem] bg-gradient-to-br from-burgundy to-burgundy-light opacity-10" />
          <div className="absolute -inset-2 rounded-[3rem] bg-gradient-to-br from-burgundy to-burgundy-light opacity-15" />
        </>
      )}
      {variant === 'gray' && (
        <>
          <div className="absolute -inset-8 rounded-[3.5rem] bg-gray-300 opacity-10" />
          <div className="absolute -inset-2 rounded-[3rem] bg-gray-400 opacity-15" />
        </>
      )}
      <div className="relative overflow-hidden rounded-[2.5rem] shadow-2xl">{children}</div>
    </div>
  );
}
