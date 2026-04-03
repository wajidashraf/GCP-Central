import { Eye, File, FileImage, FileSpreadsheet, FileText } from "lucide-react";

type UploadedDocumentPreviewProps = {
  documentUrl: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileTypeIcon(mimeType: string) {
  const normalizedMimeType = mimeType.toLowerCase();

  if (normalizedMimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
  }

  if (
    normalizedMimeType.includes("excel") ||
    normalizedMimeType.includes("spreadsheet") ||
    normalizedMimeType.includes("csv")
  ) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-700" aria-hidden="true" />;
  }

  if (
    normalizedMimeType.includes("word") ||
    normalizedMimeType.includes("document") ||
    normalizedMimeType.includes("pdf")
  ) {
    return <FileText className="h-5 w-5 text-sky-700" aria-hidden="true" />;
  }

  return <File className="h-5 w-5 text-slate-600" aria-hidden="true" />;
}

export default function UploadedDocumentPreview({
  documentUrl,
  documentFileName,
  documentMimeType,
  documentSizeBytes,
}: UploadedDocumentPreviewProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0">{getFileTypeIcon(documentMimeType)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{documentFileName}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {documentMimeType} • {formatFileSize(documentSizeBytes)}
            </p>
          </div>
        </div>

        <a
          href={documentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--border-strong)]"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          View
        </a>
      </div>
    </div>
  );
}
