import { LIMITS } from '../limits';
import type { ExportStyle } from './types';

/** Letters NFKD doesn't decompose to ASCII. */
const ASCII_MAP: Record<string, string> = {
  ı: 'i',
  İ: 'I',
  ß: 'ss',
  ø: 'o',
  Ø: 'O',
  æ: 'ae',
  Æ: 'AE',
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
};

/** ASCII-safe file-name slug ("Ayşe Yıldız" → "ayse-yildiz"); empty when nothing is left. */
export function fileNameSlug(name: string): string {
  return name
    .replace(/[ıİßøØæÆłŁđĐ]/g, (c) => ASCII_MAP[c] ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.export.fileNameSlugMaxChars)
    .replace(/-+$/, '');
}

/** `<slug>-resume-original.docx`, `<slug>-resume-jake.pdf`, or `resume-<style>.<ext>`. */
export function exportFileName(
  name: string | null,
  style: ExportStyle,
  ext: 'docx' | 'pdf',
): string {
  const slug = name === null ? '' : fileNameSlug(name);
  return `${slug === '' ? '' : `${slug}-`}resume-${style}.${ext}`;
}
