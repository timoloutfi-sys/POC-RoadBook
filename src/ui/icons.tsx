import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" /></>,
  plan: <><path d="M4 20V10l5 4 5-9 6 7v8z" /></>,
  screen: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M9 5v14M3 12h6" /></>,
  ride: <><circle cx="12" cy="13" r="8" /><path d="M12 13l4-4M12 5v2M4 13h2M18 13h2" /></>,
  eau: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  ravito: <><path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v8a3 3 0 0 1-3 3M17 21V3c-2 1-3 4-3 7s1 4 3 4" /></>,
  danger: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  note: <><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>,
  montee: <path d="M3 20l6-10 4 6 3-4 5 8z" />,
  settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  bluetooth: <path d="M7 7l10 10-5 4V3l5 4L7 17" />,
  gps: <><circle cx="12" cy="12" r="4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
}

export type IconName = keyof typeof P

/** Icônes dessinées, un seul trait (2) partout. */
export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  )
}
