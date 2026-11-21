import QRCode from 'qrcode';
import type { FeePayment, Student } from '../shared/types';

export interface ParsedReceiptQr {
  receiptNo: string;
  sid?: string;
  amt?: number;
}

/**
 * Generates a scannable verification URL payload for official school fee receipts.
 * Works both when scanned by a native smartphone camera and inside the in-app Bursar scanner.
 */
export function buildReceiptQrPayload(payment: FeePayment, student: Student): string {
  // Link back to this same page (works on GitHub Pages sub-paths and as a local file).
  const base =
    typeof window !== 'undefined' && window.location?.href
      ? window.location.href.split(/[?#]/)[0]
      : 'school-receipt://verify/';
  const params = new URLSearchParams({
    verifyReceipt: payment.receiptNo,
    sid: student.admissionNo,
    amt: String(payment.amount),
  });
  return `${base}?${params.toString()}`;
}

/**
 * Renders a crisp high-contrast QR code data URL for display and printing.
 */
export async function generateReceiptQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

/**
 * Parses QR payloads created by buildReceiptQrPayload, JSON strings, or raw receipt numbers (RCP-...).
 */
export function parseScannedReceiptQr(rawText: string): ParsedReceiptQr | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // 1. Try URL format (?verifyReceipt=...&sid=...&amt=...)
  if (trimmed.includes('verifyReceipt=') || trimmed.includes('receipt=')) {
    try {
      const normalizedUrl = trimmed.startsWith('http') || trimmed.includes('://')
        ? trimmed
        : `https://local.school/${trimmed.startsWith('?') ? trimmed : `?${trimmed}`}`;
      const url = new URL(normalizedUrl);
      const receiptNo =
        url.searchParams.get('verifyReceipt') ||
        url.searchParams.get('receipt') ||
        url.searchParams.get('receiptNo');
      if (receiptNo && receiptNo.trim()) {
        const sid = url.searchParams.get('sid')?.trim() || undefined;
        const amtStr = url.searchParams.get('amt');
        const amtNum = amtStr !== null && amtStr.trim() !== '' ? Number(amtStr) : NaN;
        return {
          receiptNo: receiptNo.trim(),
          sid,
          amt: Number.isFinite(amtNum) ? Math.round(amtNum) : undefined,
        };
      }
    } catch {
      // Fall through to other parsers
    }
  }

  // 2. Try JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as { receiptNo?: unknown; sid?: unknown; amt?: unknown };
      if (typeof parsed.receiptNo === 'string' && parsed.receiptNo.trim()) {
        const amtNum = typeof parsed.amt === 'number' || typeof parsed.amt === 'string' ? Number(parsed.amt) : NaN;
        return {
          receiptNo: parsed.receiptNo.trim(),
          sid: typeof parsed.sid === 'string' && parsed.sid.trim() ? parsed.sid.trim() : undefined,
          amt: Number.isFinite(amtNum) ? Math.round(amtNum) : undefined,
        };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Fallback: raw receipt number or payment ID
  return { receiptNo: trimmed };
}
