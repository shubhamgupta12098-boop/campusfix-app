export function BrandLogo({ className = '', label = 'CCMMS logo' }: { className?: string; label?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`brand-logo inline-block flex-shrink-0 bg-cover bg-center bg-no-repeat ${className}`}
    />
  );
}
