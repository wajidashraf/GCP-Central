'use client';

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/src/components/ui/button';
import { getReviewerDecisionCodesForRequestType as getReviewerDecisionCodesForRequestType } from '@/src/constants/reviewerDecisionCodes';

interface AddDecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { comment: string; decisionCode: string }) => Promise<void>;
  requestType: string;
  initialComment?: string | null;
  initialDecisionCode?: string | null;
  isLoading?: boolean;
}

interface UploadedCommentImage {
  url: string;
  publicId: string;
  fileName: string;
}

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/gif,image/webp';
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export default function AddDecisionModal({
  isOpen,
  onClose,
  onSubmit,
  requestType,
  initialComment = '',
  initialDecisionCode = '',
  isLoading = false,
}: AddDecisionModalProps) {
  const options = useMemo(
    () => getReviewerDecisionCodesForRequestType(requestType),
    [requestType]
  );

  const [comment, setComment] = useState('');
  const [decisionCode, setDecisionCode] = useState('');
  const [error, setError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedCommentImage[]>([]);
  const [removingImageUrl, setRemovingImageUrl] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const syncCommentFromEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setComment(editor.innerHTML);
  };

  const applyEditorCommand = (command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor || isLoading || isUploadingImage) return;
    editor.focus();
    document.execCommand(command, false, value);
    syncCommentFromEditor();
  };

  const insertTable = () => {
    const editor = editorRef.current;
    if (!editor || isLoading || isUploadingImage) return;
    editor.focus();
    const tableHtml = `
      <table dir="ltr" style="border-collapse:collapse; direction:ltr; text-align:left; width:100%; margin:8px 0;">
        <thead>
          <tr>
            <th dir="ltr" style="background-color:rgb(179, 178, 178); border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp; Key</th>
            <th dir="ltr" style="background-color:rgb(179, 178, 178); border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp; Value</th>
          </tr>
        </thead>
      <tbody>
          <tr>
            <td dir="ltr" style="border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp;</td>
            <td dir="ltr" style="border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp;</td>
          </tr>
          <tr>
            <td dir="ltr" style="border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp;</td>
            <td dir="ltr" style="border:1px solid #d1d5db; direction:ltr; padding:8px; text-align:left;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    syncCommentFromEditor();
  };

  const insertUploadedImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isLoading || isUploadingImage) return;

    setError('');
    if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
      setError('Please upload a PNG, JPEG, GIF, or WebP image.');
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Image must be greater than 0 bytes and no larger than 2MB.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('folder', 'gcp-central/reviewer-comments');

      const response = await fetch('/api/uploads/cloudinary-signature', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as {
        documentUrl?: string;
        documentPublicId?: string;
        documentFileName?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.documentUrl || !data.documentPublicId) {
        throw new Error(data?.message || 'Failed to upload image.');
      }
      const uploadedUrl = data.documentUrl;
      const uploadedPublicId = data.documentPublicId;

      const editor = editorRef.current;
      if (!editor) return;

      editor.focus();
      document.execCommand(
        'insertHTML',
        false,
        `<img src="${uploadedUrl}" alt="${data.documentFileName || 'Reviewer comment image'}" style="max-width:100%; border-radius:8px; margin:8px 0;" />`
      );
      syncCommentFromEditor();
      setUploadedImages((current) => [
        ...current,
        {
          url: uploadedUrl,
          publicId: uploadedPublicId,
          fileName: data.documentFileName || file.name,
        },
      ]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload image.');
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      setIsUploadingImage(false);
    }
  };

  const removeUploadedImage = async (image: UploadedCommentImage) => {
    const editor = editorRef.current;
    if (!editor || isLoading || isUploadingImage) return;

    setError('');
    setRemovingImageUrl(image.url);
    try {
      editor.querySelectorAll('img').forEach((node) => {
        if ((node as HTMLImageElement).src === image.url) {
          node.remove();
        }
      });
      syncCommentFromEditor();

      await fetch('/api/uploads/cloudinary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: image.publicId }),
      }).catch(() => null);

      setUploadedImages((current) => current.filter((item) => item.url !== image.url));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove image.');
    } finally {
      setRemovingImageUrl(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const nextComment = initialComment ?? '';
    setComment(nextComment);
    const raw = (initialDecisionCode ?? '').trim();
    const validInitial = options.some((o) => o.value === raw) ? raw : '';
    setDecisionCode(validInitial);
    setUploadedImages([]);
    setRemovingImageUrl(null);
    setError('');

    requestAnimationFrame(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = nextComment;
      }
    });
  }, [isOpen, initialComment, initialDecisionCode, options]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!decisionCode) {
      setError('Please select a decision code before submitting.');
      return;
    }
    try {
      await onSubmit({ comment: comment.trim(), decisionCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-decision-title"
      >
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h2 id="add-decision-title" className="text-xl font-bold text-[var(--text)]">
            Add reviewer decision
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Enter your reviewer comment and decision code. Submitting will move this request to Draft
            Review.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label htmlFor="reviewer-comment" className="mb-2 block text-sm font-medium text-[var(--text)]">
                Reviewer comment
              </label>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2">
                <div className="mb-2 flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyEditorCommand('bold')} disabled={isLoading || isUploadingImage}>Bold</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyEditorCommand('insertUnorderedList')} disabled={isLoading || isUploadingImage}>List</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={insertTable} disabled={isLoading || isUploadingImage}>Table</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => imageInputRef.current?.click()} disabled={isLoading || isUploadingImage}>
                    {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={insertUploadedImage}
                  />
                </div>
                <div
                  id="reviewer-comment"
                  ref={editorRef}
                  contentEditable={!isLoading && !isUploadingImage}
                  suppressContentEditableWarning
                  onInput={syncCommentFromEditor}
                  onBlur={syncCommentFromEditor}
                  aria-label="Reviewer comment rich text editor"
                  dir="ltr"
                  className="min-h-[220px] w-full overflow-auto rounded-md bg-white p-4 text-left text-sm leading-6 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--brand-100)] [&_img]:max-w-full [&_li]:ml-6 [&_li]:pl-1 [&_table]:w-full [&_table]:text-left [&_table]:[direction:ltr] [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_td]:text-left [&_td]:[direction:ltr] [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:text-left [&_th]:[direction:ltr] [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:pl-5"
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Supports bold text, bullet lists, tables, and image upload.
              </p>
              {uploadedImages.length > 0 ? (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/30 p-3">
                  <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">Uploaded images</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {uploadedImages.map((image) => (
                      <div key={image.url} className="rounded-md border border-[var(--border)] bg-white p-2">
                        <img
                          src={image.url}
                          alt={image.fileName}
                          className="mb-2 h-20 w-full rounded object-cover"
                        />
                        <p className="mb-2 truncate text-xs text-[var(--text-muted)]">{image.fileName}</p>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          className="w-full"
                          disabled={removingImageUrl === image.url || isLoading || isUploadingImage}
                          onClick={() => removeUploadedImage(image)}
                        >
                          {removingImageUrl === image.url ? 'Removing...' : 'Remove'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-[var(--text)]">
                Decision code <span className="text-red-600">*</span>
              </legend>
              <p className="text-xs text-[var(--text-muted)]">
                Select one review decision code. Code W is only shown for applicable request types.
              </p>
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                {options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer gap-3 rounded-md border border-transparent p-2 hover:bg-white/80 has-[:checked]:border-[var(--brand-300)] has-[:checked]:bg-white"
                  >
                    <input
                      type="radio"
                      name="decisionCode"
                      value={opt.value}
                      checked={decisionCode === opt.value}
                      onChange={() => setDecisionCode(opt.value)}
                      disabled={isLoading}
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand-600)]"
                    />
                    <span className="text-sm leading-snug text-[var(--text)]">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-white px-6 py-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
