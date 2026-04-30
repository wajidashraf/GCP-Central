'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import Button from '@/src/components/ui/button';
import type { EndorsementPayload } from '@/src/lib/requests/endorsement-load';

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

function defaultEndorsementText(data: EndorsementPayload) {
  const endorsement = data.endorsement;
  const companyName = data.request.companyName || 'Company Name';
  const acceptanceDate = formatGbDate(endorsement.acceptanceDate);

  if (endorsement.kind === 'PBL') {
    return `Dear ${companyName},

Based on company's business decision, at the point of review we record that this package was reviewed with ${endorsement.bidderCount ?? 0} potential bidders through ${endorsement.procurementMethod || 'Procurement Method'}.

From the guidelines and checklist, we are pleased to endorse your Prospective Bidder's List based on your Review Acceptance dated ${acceptanceDate} of our final review via GCPC Summary Review for Prospective Bidders List.

Please use this Endorsement No. for related matters to this PBL.`;
  }

  if (endorsement.kind === 'JVP') {
    return `Dear ${companyName},

Based on the company's business decision, we note that the proposed collaboration for ${endorsement.projectName || endorsement.projectCode} was reviewed by GCPC.

Referring to the information submitted and discussions held, we are pleased to ENDORSE the JV / Partnership submission based on your Review Acceptance dated ${acceptanceDate}, following our final review via the GCPC Summary Review.

Please use this Endorsement No. for related matters to this JV / Partnership formation.`;
  }

  if (endorsement.kind === 'RTP') {
    return `Dear ${companyName},

Based on company's business decision, we note that ${endorsement.projectName || data.request.requestTitle} was reviewed for registration of tender / proposal list.

From the guidelines and checklist, we are pleased to ENDORSE your submission based on your Review Acceptance dated ${acceptanceDate} of our final review via GCPC Summary Review.

Please use this Endorsement No. for related matters to this tender / proposal list.`;
  }

  return `Dear ${companyName},

From the guidelines and checklist, we are pleased to ENDORSE your request based on your Review Acceptance dated ${acceptanceDate} of our final review via GCPC Summary Review.

Please use this Endorsement No. for related matters to this request.`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read signature file'));
    reader.readAsDataURL(file);
  });
}

interface EndorsementClientProps {
  data: EndorsementPayload;
}

export default function EndorsementClient({ data }: EndorsementClientProps) {
  const router = useRouter();
  const initialText = useMemo(() => defaultEndorsementText(data), [data]);
  const localStorageKey = `endorsement:${data.request.id}`;

  const [text, setText] = useState(initialText);
  const [savedText, setSavedText] = useState(initialText);
  const [isEditingLetter, setIsEditingLetter] = useState(false);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState('');
  const [signatureSignedAt, setSignatureSignedAt] = useState<string | null>(null);
  const [isSignatureEditorOpen, setIsSignatureEditorOpen] = useState(false);
  const [sigTab, setSigTab] = useState<'draw' | 'upload'>('draw');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { letterText?: string; signatureUrl?: string; signatureSignedAt?: string | null };
      if (parsed.letterText?.trim()) {
        setText(parsed.letterText);
        setSavedText(parsed.letterText);
      }
      if (parsed.signatureUrl?.trim()) setSavedSignatureUrl(parsed.signatureUrl);
      if (parsed.signatureSignedAt) setSignatureSignedAt(parsed.signatureSignedAt);
    } catch {
      // Ignore invalid cache
    }
  }, [localStorageKey]);

  useEffect(() => {
    const payload = JSON.stringify({
      letterText: savedText,
      signatureUrl: savedSignatureUrl,
      signatureSignedAt,
    });
    window.localStorage.setItem(localStorageKey, payload);
  }, [localStorageKey, savedText, savedSignatureUrl, signatureSignedAt]);

  useEffect(() => {
    if (sigTab !== 'draw') {
      sigPadRef.current?.off();
      sigPadRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const pad = new SignaturePad(canvas, {
      minWidth: 0.8,
      maxWidth: 2.4,
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
  }, [sigTab]);

  const handleSaveLetter = () => {
    const next = text.trim();
    if (!next) {
      setError('Please enter endorsement letter text before saving.');
      return;
    }
    setSavedText(next);
    setText(next);
    setIsEditingLetter(false);
    setError('');
  };

  const handleSaveSignature = async () => {
    setError('');
    setIsSavingSignature(true);
    try {
      let dataUrl = '';
      if (sigTab === 'draw') {
        const pad = sigPadRef.current;
        if (!pad || pad.isEmpty()) {
          throw new Error('Please draw your signature before saving.');
        }
        dataUrl = pad.toDataURL('image/png');
      } else {
        if (!uploadFile) throw new Error('Please upload a signature image first.');
        dataUrl = await readFileAsDataUrl(uploadFile);
      }
      setSavedSignatureUrl(dataUrl);
      setSignatureSignedAt(new Date().toISOString());
      if (sigTab === 'draw') sigPadRef.current?.clear();
      setUploadFile(null);
      setIsSignatureEditorOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save signature');
    } finally {
      setIsSavingSignature(false);
    }
  };

  const handleRemoveSignature = () => {
    setSavedSignatureUrl('');
    setSignatureSignedAt(null);
  };

  const handlePrint = () => {
    const el = document.getElementById('endorsement-page');
    if (!el) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join('\n');
        } catch {
          return sheet.href ? `@import url("${sheet.href}");` : '';
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Endorsement</title>
          <style>${styles}</style>
        </head>
        <body>
          ${el.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => {
      printWindow.print();
      printWindow.close();
    };
  };

  const handleSubmit = async () => {
    const endorsementLetterText = (isEditingLetter ? text : savedText).trim();
    if (!endorsementLetterText) {
      setError('Please enter endorsement letter text before submitting.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${data.request.id}/endorsement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endorsementNo: data.endorsement.no,
          endorsementLetterText,
          signatureUrl: savedSignatureUrl || null,
          signatureSignedAt,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to submit endorsement');

      router.push(`/requests/${data.request.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit endorsement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button href={`/requests/${data.request.id}`} variant="secondary" size="sm">
          Back
        </Button>
        <button className="inline-flex items-center rounded-md border border-[#91c0fa] bg-[var(--info-bg)] px-3 py-1.5 text-sm font-medium text-[var(--info-text)] shadow-sm hover:brightness-95 print:hidden" onClick={handlePrint}>
          Print
        </button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-white shadow-sm" id="endorsement-page">
        <div className="border-b border-[var(--border)] px-5 py-4 text-center">
          <h1 className="text-lg font-bold tracking-wide text-[var(--text)]">{data.endorsement.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{data.endorsement.subtitle}</p>
          <div className="mt-4 rounded-md bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text)]">
            ENDORSEMENT NO.: <span className="ml-2">{data.endorsement.no}</span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="w-44 bg-[var(--surface-muted)] px-3 py-2 font-medium">Project Code</td>
                  <td className="px-3 py-2">{data.endorsement.projectCode}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Review No.</td>
                  <td className="px-3 py-2">{data.endorsement.reviewNo}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Date of Review</td>
                  <td className="px-3 py-2">{formatGbDate(data.endorsement.reviewDate)}</td>
                </tr>
                <tr>
                  <td className="bg-[var(--surface-muted)] px-3 py-2 font-medium">Review Acceptance Date</td>
                  <td className="px-3 py-2">{formatGbDate(data.endorsement.acceptanceDate)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 text-sm leading-6 text-[var(--text)]">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold"></h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] print:hidden"
                onClick={() => {
                  setIsEditingLetter((prev) => !prev);
                  setError('');
                }}
                aria-label={isEditingLetter ? 'Stop editing endorsement letter' : 'Edit endorsement letter'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
                {isEditingLetter ? 'Close' : 'Edit'}
              </button>
            </div>
            {isEditingLetter ? (
              <div className="space-y-2 print:hidden">
                <textarea
                  className="min-h-52 w-full rounded-lg border border-[var(--border)] p-3 text-sm outline-none focus:border-[var(--brand-500)]"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={handleSaveLetter}>
                    Save Letter
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-gray-50 p-4">
              {savedText}
            </div>
          </div>

          <div className="p-4">
            {isSignatureEditorOpen ? (
              <div className="space-y-3 print:hidden">
                <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex gap-2">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${sigTab === 'draw' ? 'bg-[var(--brand-500)] text-white' : 'bg-[var(--surface-muted)] text-[var(--text)]'}`}
                    onClick={() => setSigTab('draw')}
                  >
                    Draw
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${sigTab === 'upload' ? 'bg-[var(--brand-500)] text-white' : 'bg-[var(--surface-muted)] text-[var(--text)]'}`}
                    onClick={() => setSigTab('upload')}
                  >
                    Upload
                  </button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsSignatureEditorOpen(false)}>
                    Close
                  </Button>
                </div>
                {sigTab === 'draw' ? (
                  <div className="space-y-2">
                    <div ref={wrapperRef} className="relative h-36 w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white">
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
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" loading={isSavingSignature} onClick={() => void handleSaveSignature()}>
                    Save Signature
                  </Button>
                  <Button type="button" variant="danger" size="sm" onClick={handleRemoveSignature}>
                    Remove Signature
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-8">
            <div className="relative mb-2 min-h-[90px] w-64 rounded-md border border-dashed border-[var(--border)] p-2">
              <button
                type="button"
                className="absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--text)] hover:bg-[var(--surface-muted)] print:hidden"
                onClick={() => setIsSignatureEditorOpen((prev) => !prev)}
                aria-label={isSignatureEditorOpen ? 'Close signature editor' : 'Edit signature'}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
              </button>
              {savedSignatureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- preview signature data URL
                <img src={savedSignatureUrl} alt="Endorsement signature" className="h-full max-h-20 max-w-full object-contain" />
              ) : null}
            </div>
            <div className="mb-3 h-px w-64 bg-[var(--border-strong)]" />
            <p className="mb-1 text-sm text-[var(--text-muted)]">On behalf of</p>
            <p className="font-semibold text-[var(--text)]">Group Contracts and Procurement Committee</p>
            <p className="text-xs text-[var(--text-muted)]">
              Signed at: {signatureSignedAt ? formatGbDate(signatureSignedAt) : 'Not signed'}
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm">
            <h2 className="mb-2 font-semibold text-[var(--text)]">Attachments:</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[var(--text)]">
              <li>Company Review Acceptance</li>
              <li>GCPC Summary Review signed by Members</li>
            </ol>
          </div>

          <div className="space-y-1 text-sm italic text-[var(--text-muted)]">
            <p className="font-bold">cc.</p>
            <p>GEXCO</p>
            <p>GCPC Chairman- Dato Rosli b Husin</p>
            <p>GCPC Member- Mohammad Nadzif b Bustari</p>
            <p>GCPC Member- Hafitz b Khalid</p>
            <p>GCPC Member- Ivy Lau</p>
            <p>GCPC Member- Foong Pak Chee</p>
            <p>OEC</p>
            <p>Company Team Leader</p>
          </div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 print:hidden">{error}</div> : null}

      <div className="mt-6 flex justify-end print:hidden">
        <Button type="button" variant="primary" size="sm" disabled={isSubmitting} onClick={() => void handleSubmit()}>
          {isSubmitting ? 'Submitting…' : 'Submit'}
        </Button>
      </div>
    </div>
  );
}
