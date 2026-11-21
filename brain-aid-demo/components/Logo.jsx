export default function Logo({ size = 28 }) {
  return (
    <svg
      className="brand-cross"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 4h6v9h9v6h-9v9h-6v-9H4v-6h9V4z"
        fill="currentColor"
      />
    </svg>
  );
}
