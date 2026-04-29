"use client";

import { useState } from "react";

type ImagePreviewTriggerProps = {
  imageUrl: string;
  alt: string;
  label?: string;
  showThumbnail?: boolean;
};

export default function ImagePreviewTrigger({
  imageUrl,
  alt,
  label = "Preview image",
  showThumbnail = true,
}: ImagePreviewTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {showThumbnail ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded border border-[var(--border)]"
          aria-label={label}
          title={label}
        >
          <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />
          <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-3 w-3"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center rounded-md border border-[var(--border)] p-1.5 text-[var(--text)] hover:bg-[var(--surface-soft)]"
          aria-label={label}
          title={label}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-h-[85vh] max-w-[85vw] rounded-lg bg-white p-2 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-white text-sm text-[var(--text)] hover:bg-[var(--surface-soft)]"
              aria-label="Close preview"
            >
              ×
            </button>
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[80vh] max-w-[80vw] rounded object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
