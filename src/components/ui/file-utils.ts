/**
 * File Type Utilities
 * Helpers for detecting file types and styling
 */

export type FileType = 'xlsx' | 'pdf' | 'docx' | 'image' | 'other';

export function getFileType(fileName?: string | null): FileType {
  if (!fileName) return 'other';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext ?? '')) return 'image';
  return 'other';
}

export const FILE_BADGE_STYLES: Record<FileType, string> = {
  xlsx:  'bg-emerald-100 text-emerald-800',
  pdf:   'bg-red-100    text-red-800',
  docx:  'bg-blue-100   text-blue-800',
  image: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100   text-gray-600',
};

export const FILE_BADGE_LABEL: Record<FileType, string> = {
  xlsx:  'xlsx',
  pdf:   'pdf',
  docx:  'docx',
  image: 'image',
  other: 'file',
};
