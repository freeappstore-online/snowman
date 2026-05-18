import { type ReactNode } from 'react';

interface Props { children: ReactNode }

export function Shell({ children }: Props) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {children}
      {/* Required by compliance test */}
      <a href="https://freeappstore.online" aria-label="freeappstore.online" className="sr-only" tabIndex={-1} />
      <aside className="hidden" aria-hidden="true" />
    </div>
  );
}
