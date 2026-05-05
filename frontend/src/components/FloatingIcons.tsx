export function FloatingIcons() {
  return (
    <>
      <div
        className="pointer-events-none absolute right-[4%] top-[8%] z-0 animate-cap-bounce"
        aria-hidden
      >
        <svg
          className="h-[52px] w-[52px] drop-shadow-[0_6px_12px_rgba(74,124,89,0.2)]"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="32" cy="24" rx="26" ry="9" fill="#2B4728" />
          <rect x="18" y="14" width="28" height="10" rx="2" fill="#2B4728" />
          <rect x="16" y="12" width="32" height="5" rx="2" fill="#4A7C59" />
          <line x1="52" y1="24" x2="52" y2="42" stroke="#A8C9B3" strokeWidth="2" />
          <circle cx="52" cy="44" r="4" fill="#A8C9B3" />
          <ellipse cx="24" cy="19" rx="6" ry="2" fill="white" opacity="0.15" />
        </svg>
      </div>

      <div
        className="pointer-events-none absolute left-[5%] top-[45%] z-0 animate-book-bounce"
        aria-hidden
      >
        <svg
          className="h-12 w-12 drop-shadow-[0_6px_12px_rgba(74,124,89,0.2)]"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="14" y="12" width="36" height="40" rx="2" fill="#4A7C59" />
          <rect x="16" y="14" width="32" height="36" rx="1" fill="white" />
          <line x1="20" y1="22" x2="44" y2="22" stroke="#4A7C59" strokeWidth="2" />
          <line x1="20" y1="28" x2="44" y2="28" stroke="#A8C9B3" strokeWidth="2" />
          <line x1="20" y1="34" x2="38" y2="34" stroke="#A8C9B3" strokeWidth="2" />
          <rect x="14" y="12" width="4" height="40" fill="#2B4728" />
        </svg>
      </div>

      <div
        className="pointer-events-none absolute bottom-[25%] right-[8%] z-0 animate-pencil-bounce"
        aria-hidden
      >
        <svg
          className="h-[46px] w-[46px] drop-shadow-[0_6px_12px_rgba(74,124,89,0.2)]"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="20" y="10" width="8" height="44" rx="1" fill="#4A7C59" />
          <polygon points="24,54 28,54 32,62 20,62" fill="#2B4728" />
          <rect x="20" y="10" width="8" height="8" fill="#6FA382" />
          <circle cx="24" cy="14" r="1" fill="white" opacity="0.5" />
        </svg>
      </div>
    </>
  );
}
