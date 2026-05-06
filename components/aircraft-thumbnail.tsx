export function AircraftThumbnail({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 32"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simple jet silhouette */}
      <path
        d="M4 18 L18 16 L28 8 L32 8 L26 16 L48 14 L52 6 L56 6 L54 14 L60 13 L60 17 L54 18 L56 26 L52 26 L48 18 L26 16 L32 24 L28 24 L18 16 L4 18Z"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  );
}
