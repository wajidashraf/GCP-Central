/**
 * File Type Icons
 * SVG icons for different file types (Excel, PDF, Word, Image, Generic)
 */

export function ExcelIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#E8F5E9" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#c8e6c9" strokeWidth="1.5" />
      {/* Green sidebar */}
      <rect x="8" y="8" width="22" height="48" rx="7" fill="#1D6F42" />
      <rect x="18" y="8" width="12" height="48" fill="#1D6F42" />
      <text x="12" y="36" fontSize="14" fontWeight="800" fill="white" fontFamily="sans-serif">X</text>
      {/* Grid lines */}
      <line x1="30" y1="22" x2="56" y2="22" stroke="#b2dfdb" strokeWidth="1.5" />
      <line x1="30" y1="32" x2="56" y2="32" stroke="#b2dfdb" strokeWidth="1.5" />
      <line x1="30" y1="42" x2="56" y2="42" stroke="#b2dfdb" strokeWidth="1.5" />
      {/* Cells */}
      <rect x="32" y="24" width="9" height="7" rx="1" fill="#c8e6c9" />
      <rect x="44" y="24" width="9" height="7" rx="1" fill="#a5d6a7" />
      <rect x="32" y="34" width="9" height="7" rx="1" fill="#a5d6a7" />
      <rect x="44" y="34" width="9" height="7" rx="1" fill="#c8e6c9" />
    </svg>
  );
}

export function PdfIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#FEE2E2" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#fecaca" strokeWidth="1.5" />
      <path d="M16 14 H37 L50 27 V50 H16 Z" fill="#EF4444" />
      <path d="M37 14 L37 27 L50 27 Z" fill="#B91C1C" />
      <text x="20" y="43" fontSize="11" fontWeight="800" fill="white" fontFamily="sans-serif">PDF</text>
    </svg>
  );
}

export function WordIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#DBEAFE" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1.5" />
      {/* Blue sidebar */}
      <rect x="8" y="8" width="22" height="48" rx="7" fill="#1D4ED8" />
      <rect x="18" y="8" width="12" height="48" fill="#1D4ED8" />
      <text x="11" y="36" fontSize="13" fontWeight="800" fill="white" fontFamily="sans-serif">W</text>
      {/* Document lines */}
      <line x1="30" y1="22" x2="56" y2="22" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="29" x2="56" y2="29" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="36" x2="52" y2="36" stroke="#bfdbfe" strokeWidth="1.5" />
      <line x1="30" y1="43" x2="50" y2="43" stroke="#bfdbfe" strokeWidth="1.5" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#FDF4FF" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#e9d5ff" strokeWidth="1.5" />
      <rect x="14" y="14" width="36" height="36" rx="4" fill="#A855F7" />
      {/* Mountain scene */}
      <path d="M14 38 L26 24 L34 32 L40 26 L50 38 Z" fill="#7C3AED" />
      {/* Sun */}
      <circle cx="42" cy="22" r="5" fill="#FDE68A" />
    </svg>
  );
}

export function GenericFileIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-16 w-16">
      <rect width="64" height="64" rx="10" fill="#F3F4F6" />
      <rect x="8" y="8" width="48" height="48" rx="7" fill="#ffffff" stroke="#e5e7eb" strokeWidth="1.5" />
      <path d="M18 14 H37 L46 23 V50 H18 Z" fill="#6B7280" />
      <path d="M37 14 L37 23 L46 23 Z" fill="#4B5563" />
      <line x1="24" y1="32" x2="40" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="38" x2="40" y2="38" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="44" x2="34" y2="44" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
