import { useState } from "react";
import { Eye, File, FileImage, FileSpreadsheet, FileText, Trash2 } from "lucide-react";

type UploadedDocumentPreviewProps = {
  documentUrl: string;
  documentPublicId?: string;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  requestId?: string | null;
  requestType?: string;
  onRemoved?: () => void;
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
    return (
      <FileImage
        className="flex h-5 w-5 flex-nowrap flex-col items-center justify-center text-emerald-600"
        aria-hidden="true"
      />
    );
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
  documentPublicId,
  documentFileName,
  documentMimeType,
  documentSizeBytes,
  requestId,
  requestType,
  onRemoved,
}: UploadedDocumentPreviewProps) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemoveDocument() {
    if (!documentPublicId) {
      return;
    }
    setRemoveError(null);
    setIsRemoving(true);

    try {
      const response = await fetch("/api/uploads/cloudinary", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicId: documentPublicId, requestId, requestType }),
      });

      if (!response.ok) {
        const responseData = (await response.json()) as { message?: string };
        setRemoveError(responseData.message ?? "Failed to remove uploaded document.");
        return;
      }

      onRemoved?.();
    } catch {
      setRemoveError("Failed to remove uploaded document.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
            {getFileTypeIcon(documentMimeType)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{documentFileName}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {documentMimeType} • {formatFileSize(documentSizeBytes)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--text)] transition hover:border-[var(--border-strong)]"
            aria-label="View uploaded document"
            title="View document"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </a>
          {documentPublicId ? (
            <button
              type="button"
              onClick={handleRemoveDocument}
              disabled={isRemoving}
              className="inline-flex h-8 w-fit max-w-[99px] items-center justify-center rounded-lg border border-rose-200 bg-white px-2 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={isRemoving ? "Removing uploaded document" : "Remove uploaded document"}
              title={isRemoving ? "Removing..." : "Remove document"}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {removeError ? <p className="mt-2 text-xs text-[var(--danger-text)]">{removeError}</p> : null}
    </div>
  );
}
