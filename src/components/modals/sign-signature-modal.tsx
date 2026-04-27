'use client';

import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import Button from '@/src/components/ui/button';

type Tab = 'draw' | 'upload';

export type SignModalMember = {
  id: string;
  name: string;
  email: string;
  group: 'prepared' | 'confirmed';
};

interface SignSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  member: SignModalMember | null;
  onComplete: () => void;
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], fileName, { type: mime });
}

export default function SignSignatureModal({
  isOpen,
  onClose,
  requestId,
  member,
  onComplete,
}: SignSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [tab, setTab] = useState<Tab>('draw');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTab('draw');
      setUploadFile(null);
      setPreviewUrl(null);
      setError('');
      sigPadRef.current?.off();
      sigPadRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!uploadFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);

  useEffect(() => {
    if (!isOpen || tab !== 'draw') {
      sigPadRef.current?.off();
      sigPadRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const pad = new SignaturePad(canvas, {
      minWidth: 0.8,
      maxWidth: 2.6,
      penColor: '#111827',
      backgroundColor: 'rgba(0,0,0,0)',
    });
    sigPadRef.current = pad;

    const resize = () => {
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;
      if (width <= 0 || height <= 0) return;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      pad.clear();
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrapper);
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      ro?.disconnect();
      pad.off();
      sigPadRef.current = null;
    };
  }, [isOpen, tab]);

  const handleClearDraw = () => {
    sigPadRef.current?.clear();
  };

  const handleSubmit = async () => {
    if (!member) return;
    setError('');
    setIsSubmitting(true);
    try {
      let file: File;
      if (tab === 'draw') {
        const pad = sigPadRef.current;
        if (!pad || pad.isEmpty()) {
          setError('Please draw your signature first.');
          setIsSubmitting(false);
          return;
        }
        const url = pad.toDataURL('image/png');
        file = dataUrlToFile(url, `signature-${member.id}.png`);
      } else {
        if (!uploadFile) {
          setError('Please choose an image file.');
          setIsSubmitting(false);
          return;
        }
        file = uploadFile;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `gcp-central/signatures/${requestId}`);

      const up = await fetch('/api/uploads/cloudinary-signature', { method: 'POST', body: fd });
      const upJson = await up.json().catch(() => null);
      if (!up.ok) throw new Error(upJson?.message || 'Upload failed');

      const sigRes = await fetch(`/api/requests/${requestId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatoryMemberId: member.id,
          signUrl: upJson.documentUrl,
          signPublicId: upJson.documentPublicId ?? undefined,
        }),
      });
      const sigJson = await sigRes.json().catch(() => null);
      if (!sigRes.ok) throw new Error(sigJson?.error || 'Failed to save signature');

      onComplete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-xl font-bold text-[var(--text)]">Add your signature</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Signing as <strong>{member.name}</strong> ({member.email})
        </p>

        <div className="mb-4 flex gap-2 border-b border-[var(--border)] pb-2">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'draw'
                ? 'bg-[var(--brand-500)] text-white'
                : 'bg-[var(--surface-muted)] text-[var(--text)]'
            }`}
            onClick={() => setTab('draw')}
          >
            Draw
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === 'upload'
                ? 'bg-[var(--brand-500)] text-white'
                : 'bg-[var(--surface-muted)] text-[var(--text)]'
            }`}
            onClick={() => setTab('upload')}
          >
            Upload
          </button>
        </div>

        {tab === 'draw' ? (
          <div className="space-y-2">
            <div
              ref={wrapperRef}
              className="relative h-44 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white"
            >
              <canvas ref={canvasRef} className="touch-none" />
            </div>
            <button
              type="button"
              className="text-sm text-[var(--brand-600)] underline"
              onClick={handleClearDraw}
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="block w-full text-sm text-[var(--text)]"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              <div className="flex h-40 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
              </div>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}
