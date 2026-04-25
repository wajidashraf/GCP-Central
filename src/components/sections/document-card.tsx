import { ReactNode } from 'react';
import {
  ExcelIcon,
  PdfIcon,
  WordIcon,
  ImageIcon,
  GenericFileIcon,
} from '@/src/components/ui/file-icons';
import { getFileType, FILE_BADGE_STYLES, FILE_BADGE_LABEL, FileType } from '@/src/components/ui/file-utils';

export type DocumentItem = {
  label: string;
  url: string;
  fileName?: string | null;
};

const iconMap: Record<FileType, ReactNode> = {
  xlsx:  <ExcelIcon />,
  pdf:   <PdfIcon />,
  docx:  <WordIcon />,
  image: <ImageIcon />,
  other: <GenericFileIcon />,
};

export function DocumentCard({ doc }: { doc: DocumentItem }) {
  const fileType = getFileType(doc.fileName);
  const displayName = doc.fileName ?? 'Download document';

  return (
    <a
      href={doc.url}
      download
      target="_blank"
      rel="noopener noreferrer"
      title={`Download ${displayName}`}
      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface,#f8fafc)] px-3 py-2.5 no-underline transition-all duration-150 hover:border-[var(--brand-600)] hover:bg-[var(--brand-50,#eef2ff)] hover:shadow-[0_4px_16px_rgba(59,91,219,0.12)]"
    >
      {/* Left: icon (50% of original h-16 w-16) + badge stacked */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="[&>svg]:h-8 [&>svg]:w-8">{iconMap[fileType]}</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${FILE_BADGE_STYLES[fileType]}`}
        >
          {FILE_BADGE_LABEL[fileType]}
        </span>
      </div>

      {/* Right: filename */}
      <span className="max-w-[140px] break-words text-xs font-medium leading-snug text-[var(--text)] transition-colors group-hover:text-[var(--brand-600)]">
        {displayName}
      </span>
    </a>
  );
}

const MAX_VISIBLE_DOCS = 2;

export function DocumentCards({ documents }: { documents: DocumentItem[] }) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">No documents attached to this request.</p>
    );
  }

  const visible  = documents.slice(0, MAX_VISIBLE_DOCS);
  const overflow = documents.length - MAX_VISIBLE_DOCS;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {visible.map((doc) => (
        <DocumentCard key={`${doc.label}-${doc.url}`} doc={doc} />
      ))}
      {overflow > 0 && (
        <span className="text-sm font-medium text-[var(--text-muted)]">
          +{overflow} More
        </span>
      )}
    </div>
  );
}
