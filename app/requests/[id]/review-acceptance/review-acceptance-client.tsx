'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SignaturePad from 'signature_pad';
import Button from '@/src/components/ui/button';
import type { ReviewAcceptancePayload } from '@/src/lib/requests/review-acceptance-load';

type SelectedCode = '1a' | '1b' | '2' | '3' | '4';

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

function formatGbDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function applyPayloadToFormState(payload: ReviewAcceptancePayload) {
  const f = payload.form;
  const selected = (f.selectedCode ?? '') as SelectedCode | '';
  const ex = f.code1bExceptions?.length ? [...f.code1bExceptions] : ['', '', ''];
  while (ex.length < 3) ex.push('');
  return {
    selectedCode: selected,
    exceptions: ex.slice(0, 3),
  };
}

interface ReviewAcceptanceClientProps {
  requestId: string;
  initialData: ReviewAcceptancePayload;
}

export default function ReviewAcceptanceClient({ requestId, initialData }: ReviewAcceptanceClientProps) {
  const router = useRouter();
  const [data, setData] = useState<ReviewAcceptancePayload>(initialData);

  const [selectedCode, setSelectedCode] = useState<SelectedCode | ''>(() =>
    (initialData.form.selectedCode ?? '') as SelectedCode | ''
  );
  const [exceptions, setExceptions] = useState<string[]>(() => {
    const ex = initialData.form.code1bExceptions?.length ? [...initialData.form.code1bExceptions] : ['', '', ''];
    while (ex.length < 3) ex.push('');
    return ex.slice(0, 3);
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const [sigTab, setSigTab] = useState<'draw' | 'upload'>('draw');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setData(initialData);
    const next = applyPayloadToFormState(initialData);
    setSelectedCode(next.selectedCode);
    setExceptions(next.exceptions);
  }, [initialData]);

  const readOnly = Boolean(data.readOnly);
  const hasServerSignature = Boolean(data.signature?.signUrl);

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
    if (readOnly || hasServerSignature || sigTab !== 'draw') {
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
  }, [readOnly, hasServerSignature, sigTab, data]);

  const showExceptions = selectedCode === '1b';

  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!selectedCode) {
      setSubmitError('Please select a conclusion code.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (hasServerSignature) {
        setSubmitError('This form has already been signed.');
        setIsSubmitting(false);
        return;
      }
      let file: File;
      if (sigTab === 'draw') {
        const pad = sigPadRef.current;
        if (!pad || pad.isEmpty()) {
          setSubmitError('Please draw your signature or switch to Upload.');
          setIsSubmitting(false);
          return;
        }
        file = dataUrlToFile(pad.toDataURL('image/png'), `hoc-signature-${requestId}.png`);
      } else {
        if (!uploadFile) {
          setSubmitError('Please choose a signature image to upload.');
          setIsSubmitting(false);
          return;
        }
        file = uploadFile;
      }

      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', `gcp-central/signatures/${requestId}/hoc-acceptance`);

      const up = await fetch('/api/uploads/cloudinary-signature', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const upJson = await up.json().catch(() => null);
      if (!up.ok) throw new Error(upJson?.message || 'Signature upload failed');

      const payload = {
        selectedCode,
        code1bExceptions: selectedCode === '1b' ? exceptions : [],
        signUrl: upJson.documentUrl as string,
        signPublicId: upJson.documentPublicId ?? null,
      };

      const res = await fetch(`/api/requests/${requestId}/review-acceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) throw new Error(out?.error || 'Submit failed');

      router.refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewDateDisplay = formatGbDate(
    data.request.verifiedAt ?? data.latestEngagement?.updatedAt ?? null
  );
  const reviewNoDisplay = data.latestEngagement?.engagementNumber ?? '—';
  const reviewLogNo = data.request.requestTitle || data.request.requestNo;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button href={`/requests/${requestId}`} variant="secondary" size="sm">
          Back
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handlePrint}>
          Print
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h1 className="text-lg font-bold tracking-wide text-[var(--text)]">REVIEW ACCEPTANCE</h1>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex w-full max-w-xs justify-between gap-2">
              <span className="text-[var(--text-muted)]">Review Log No:</span>
              <span className="font-semibold text-[var(--text)]">{reviewLogNo}</span>
            </div>
            <div className="flex w-full max-w-xs justify-between gap-2">
              <span className="text-[var(--text-muted)]">Review No:</span>
              <span className="font-semibold text-[var(--text)]">{reviewNoDisplay}</span>
            </div>
            <div className="flex w-full max-w-xs justify-between gap-2">
              <span className="text-[var(--text-muted)]">Review Date:</span>
              <span className="font-semibold text-[var(--text)]">{reviewDateDisplay}</span>
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          <p className="text-sm text-[var(--text)]">
            <strong>Please tick ( / ) based on GCPC Summary Review Conclusion Code.</strong>
          </p>

          <div className={`space-y-3 ${readOnly ? 'opacity-90' : ''}`}>
            <label className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-[var(--surface-muted)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="radio"
                name="gcpcCode"
                value="1a"
                checked={selectedCode === '1a'}
                disabled={readOnly}
                onChange={() => setSelectedCode('1a')}
                className="mt-1"
              />
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">Code 1 (a)</span> — We agree to incorporate all of your comments in
                our submission and/or future action or during implementation.
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-[var(--surface-muted)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="radio"
                name="gcpcCode"
                value="1b"
                checked={selectedCode === '1b'}
                disabled={readOnly}
                onChange={() => setSelectedCode('1b')}
                className="mt-1"
              />
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">Code 1 (b)</span> — We agree to incorporate all of your comments in
                our submission and/or future action or during implementation, <u>EXCEPT</u> the following which we will
                undertake to mitigate all related risks:
              </span>
            </label>

            {showExceptions ? (
              <ol className="ml-8 list-decimal space-y-2 border-l-2 border-[var(--border)] pl-4">
                {[0, 1, 2].map((i) => (
                  <li key={i}>
                    <input
                      type="text"
                      className="w-full border-0 border-b border-dotted border-[var(--border)] bg-transparent py-1 text-sm outline-none focus:border-[var(--brand-500)]"
                      placeholder="Type exception / mitigation…"
                      value={exceptions[i] ?? ''}
                      disabled={readOnly}
                      onChange={(e) => {
                        const next = [...exceptions];
                        next[i] = e.target.value;
                        setExceptions(next);
                      }}
                    />
                  </li>
                ))}
              </ol>
            ) : null}

            <label className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-[var(--surface-muted)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="radio"
                name="gcpcCode"
                value="2"
                checked={selectedCode === '2'}
                disabled={readOnly}
                onChange={() => setSelectedCode('2')}
                className="mt-1"
              />
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">Code 2</span> — We acknowledge the need to resubmit the document and
                incorporate your comments regarding the Prospective Bidders List.
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-[var(--surface-muted)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="radio"
                name="gcpcCode"
                value="3"
                checked={selectedCode === '3'}
                disabled={readOnly}
                onChange={() => setSelectedCode('3')}
                className="mt-1"
              />
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">Code 3</span> — Acknowledged. We admit the non-compliance.
              </span>
            </label>

            <label className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-[var(--surface-muted)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="radio"
                name="gcpcCode"
                value="4"
                checked={selectedCode === '4'}
                disabled={readOnly}
                onChange={() => setSelectedCode('4')}
                className="mt-1"
              />
              <span className="text-sm text-[var(--text)]">
                <span className="font-semibold">Code 4</span> — Acknowledged. Exemption letter as per attached.
              </span>
            </label>
          </div>

          <hr className="border-[var(--border)]" />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            <div
              className={`flex min-h-[140px] flex-1 items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 ${
                hasServerSignature ? 'border-solid' : ''
              }`}
            >
              {data.signature?.signUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary URL
                <img
                  src={data.signature.signUrl}
                  alt="Head of Company signature"
                  className="max-h-32 max-w-full object-contain"
                />
              ) : (
                <span className="text-sm text-[var(--text-muted)]">Awaiting signature</span>
              )}
            </div>
            <div className="relative flex-1 text-sm text-[var(--text-muted)]">
              <p>Accepted by</p>
              <p className="font-medium text-[var(--text)]">Head of Company</p>
              <p>
                Date:{' '}
                <span className="text-[var(--text)]">
                  {data.signature?.signedAt ? formatGbDate(data.signature.signedAt) : 'Not signed'}
                </span>
              </p>
            </div>
          </div>

          {!readOnly && !hasServerSignature ? (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="mb-2 text-sm font-medium text-[var(--text)]">Your signature</p>
              <div className="mb-3 flex gap-2 border-b border-[var(--border)] pb-2">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    sigTab === 'draw'
                      ? 'bg-[var(--brand-500)] text-white'
                      : 'bg-[var(--surface-muted)] text-[var(--text)]'
                  }`}
                  onClick={() => setSigTab('draw')}
                >
                  Draw
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    sigTab === 'upload'
                      ? 'bg-[var(--brand-500)] text-white'
                      : 'bg-[var(--surface-muted)] text-[var(--text)]'
                  }`}
                  onClick={() => setSigTab('upload')}
                >
                  Upload
                </button>
              </div>
              {sigTab === 'draw' ? (
                <div className="space-y-2">
                  <div
                    ref={wrapperRef}
                    className="relative h-40 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white"
                  >
                    <canvas ref={canvasRef} className="touch-none" />
                  </div>
                  <button
                    type="button"
                    className="text-sm text-[var(--brand-600)] underline"
                    onClick={() => sigPadRef.current?.clear()}
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    className="block w-full text-sm"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  />
                  {previewUrl ? (
                    <div className="flex h-36 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {submitError ? (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{submitError}</div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2 print:hidden">
        {!readOnly ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isSubmitting || !selectedCode}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </Button>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {hasServerSignature
              ? 'Submitted. Request status is now Pending Endorse.'
              : 'Changes cannot be submitted for this request in its current status.'}{' '}
            <Link href={`/requests/${requestId}`} className="text-[var(--brand-600)] underline">
              Return to request
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
