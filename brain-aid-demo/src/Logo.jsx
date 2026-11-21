/** Brain Aid mark: first-aid kit with a brain + aid cross. */
export default function Logo({ size = 28, className = '', title = 'Brain Aid' }) {
  const id = `ba-${size}`
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`${id}-kit`} x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1A6B52" />
          <stop offset="1" stopColor="#0A3227" />
        </linearGradient>
      </defs>

      {/* Kit body */}
      <rect x="6" y="16" width="52" height="42" rx="10" fill={`url(#${id}-kit)`} />
      {/* Handle */}
      <rect x="22" y="8" width="20" height="12" rx="5" fill="#0A3227" />
      <rect x="27" y="5" width="10" height="7" rx="3.5" fill="#E8A838" />
      {/* Latch */}
      <rect x="28" y="20" width="8" height="5" rx="1.5" fill="#E8A838" />

      {/* Inner cream panel */}
      <rect x="12" y="28" width="40" height="24" rx="6" fill="#F4FAF7" />

      {/* Brain */}
      <path
        d="M24.8 33.2c-3.6.2-6.3 3-6.3 6.4 0 1.5.5 2.8 1.5 3.8-.5.6-.8 1.4-.8 2.2 0 2 1.6 3.6 3.6 3.6h.6c.5 1.5 1.9 2.6 3.6 2.6 1.2 0 2.2-.5 2.9-1.4.6.9 1.7 1.4 2.9 1.4 1.7 0 3.1-1.1 3.6-2.6h.6c2 0 3.6-1.6 3.6-3.6 0-.8-.3-1.6-.8-2.2 1-1 1.5-2.3 1.5-3.8 0-3.4-2.7-6.2-6.3-6.4-1.4-.1-2.7.4-3.8 1.2-1.1-.8-2.4-1.3-3.8-1.2z"
        fill="#114B3A"
      />
      <path
        d="M32 36.2c-.2 2.4-.3 4.6-.3 7M27.6 38c1.5.9 3.1 1.3 4.7 1.5M36.4 38c-1.5.9-3.1 1.3-4.7 1.5"
        stroke="#7EB8C9"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Aid cross sticker */}
      <circle cx="48" cy="24" r="10" fill="#E06B4A" />
      <circle cx="48" cy="24" r="10" stroke="#FFF7F4" strokeWidth="2" opacity="0.35" />
      <path
        d="M48 18.2v11.6M42.2 24h11.6"
        stroke="#FFF7F4"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  )
}
