import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  MessageSquare,
  Phone,
  RotateCcw,
  X,
} from 'lucide-react';
import type { SchoolProfile, StudentFeeSummary } from '../shared/types';
import {
  type DefaulterSmsTier,
  exportDefaulterSmsCsv,
  formatUGX,
  generateDefaulterSmsText,
  getRecommendedSmsTier,
  getSmsTierLabel,
} from '../utils/schoolFinance';

export function DefaulterSmsModal({
  profile,
  rows,
  initialStudentId,
  onClose,
}: {
  profile: SchoolProfile;
  rows: StudentFeeSummary[];
  initialStudentId?: string;
  onClose: () => void;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    if (initialStudentId && rows.some((r) => r.student.id === initialStudentId)) {
      return initialStudentId;
    }
    return rows[0]?.student.id || '';
  });

  const [tierMode, setTierMode] = useState<'auto' | DefaulterSmsTier>('auto');
  const [paymentChannelNote, setPaymentChannelNote] = useState(
    "Pay via School Bank / Mobile Money or visit the Bursar's Office."
  );
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isEdited, setIsEdited] = useState(false);
  const [copiedField, setCopiedField] = useState<'sms' | 'phone' | 'bulk' | null>(null);

  const selectedIndex = useMemo(
    () => Math.max(0, rows.findIndex((r) => r.student.id === selectedStudentId)),
    [rows, selectedStudentId]
  );

  const activeRow = rows[selectedIndex] || rows[0];
  const recommendedTier = activeRow ? getRecommendedSmsTier(activeRow) : 'firm';
  const effectiveTier: DefaulterSmsTier = tierMode === 'auto' ? recommendedTier : tierMode;

  const autoMessage = useMemo(() => {
    if (!activeRow) return '';
    return generateDefaulterSmsText(activeRow, profile, {
      tier: effectiveTier,
      paymentChannelNote,
    });
  }, [activeRow, profile, effectiveTier, paymentChannelNote]);

  useEffect(() => {
    if (!isEdited) {
      setCustomMessage(autoMessage);
    }
  }, [autoMessage, isEdited]);

  const handleSelectStudent = (nextId: string) => {
    setSelectedStudentId(nextId);
    setIsEdited(false);
  };

  const handleCopy = async (text: string, field: 'sms' | 'phone') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2200);
    } catch {
      // Fallback selection copy when clipboard API is restricted
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2200);
    }
  };

  const smsLength = customMessage.length;
  const smsSegments = Math.max(1, Math.ceil(smsLength / 160));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#0B1437] via-[#132257] to-[#1E3A8A] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold truncate">Fee Defaulter SMS Templates</h3>
              <p className="text-xs text-blue-100 truncate">
                Auto-generated reminder messages tailored by outstanding UGX balance ({rows.length} owing students)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Close SMS templates modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!activeRow ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No students with outstanding fee balances in the current Defaulters view.
          </div>
        ) : (
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Student switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Select Student ({selectedIndex + 1} of {rows.length})
                </label>
                <select
                  value={activeRow.student.id}
                  onChange={(e) => handleSelectStudent(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {rows.map((r) => (
                    <option key={r.student.id} value={r.student.id}>
                      {r.student.fullName} ({r.schoolClass?.name || '—'}) — Balance: {formatUGX(r.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 pt-5">
                <button
                  type="button"
                  disabled={selectedIndex <= 0}
                  onClick={() => handleSelectStudent(rows[selectedIndex - 1].student.id)}
                  className="p-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Previous defaulter"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={selectedIndex >= rows.length - 1}
                  onClick={() => handleSelectStudent(rows[selectedIndex + 1].student.id)}
                  className="p-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Next defaulter"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Balance & Guardian Snapshot */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Guardian &amp; Phone</div>
                <div className="font-semibold text-slate-900 mt-0.5 truncate">{activeRow.student.guardianName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-slate-700">{activeRow.student.guardianPhone || 'No phone'}</span>
                  {activeRow.student.guardianPhone && (
                    <button
                      type="button"
                      onClick={() => handleCopy(activeRow.student.guardianPhone, 'phone')}
                      className="inline-flex items-center gap-1 text-blue-700 hover:underline font-medium"
                    >
                      <Phone className="w-3 h-3" />
                      {copiedField === 'phone' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Paid vs. Net Billed</div>
                <div className="font-mono font-semibold text-emerald-700 tabular-nums mt-0.5">
                  {formatUGX(activeRow.totalPaid)}
                </div>
                <div className="font-mono text-slate-500 tabular-nums mt-0.5">
                  of {formatUGX(activeRow.netBilled)} ({activeRow.percentPaid}%)
                </div>
              </div>
              <div>
                <div className="text-slate-500">Outstanding Balance</div>
                <div className="font-mono font-bold text-rose-700 tabular-nums text-sm mt-0.5">
                  {formatUGX(activeRow.balance)}
                </div>
                <div className="text-slate-600 mt-0.5 truncate">{getSmsTierLabel(recommendedTier)}</div>
              </div>
            </div>

            {/* Tone Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Message Tone (Auto-Selected by Balance)</label>
                <span className="text-xs text-blue-700 font-medium">
                  Recommended: {recommendedTier === 'urgent' ? 'Urgent' : recommendedTier === 'firm' ? 'Firm' : 'Gentle'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'auto', label: 'Auto by Balance' },
                    { id: 'gentle', label: 'Gentle Reminder' },
                    { id: 'firm', label: 'Firm Notice' },
                    { id: 'urgent', label: 'Urgent Final Notice' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setTierMode(opt.id);
                      setIsEdited(false);
                    }}
                    className={`px-3 py-2 text-xs font-medium rounded-xl border text-center transition-colors ${
                      tierMode === opt.id
                        ? 'bg-blue-700 border-blue-700 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Instructions Line */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Instructions Included in SMS
              </label>
              <input
                type="text"
                value={paymentChannelNote}
                onChange={(e) => {
                  setPaymentChannelNote(e.target.value);
                  setIsEdited(false);
                }}
                placeholder="e.g., Pay via Stanbic Bank / MTN MoMo Code 123456."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800"
              />
            </div>

            {/* Editable SMS Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-700">Ready-to-Send SMS Preview</label>
                <div className="flex items-center gap-3">
                  {isEdited && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEdited(false);
                        setCustomMessage(autoMessage);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset Template
                    </button>
                  )}
                  <span className="text-xs font-mono text-slate-500 tabular-nums">
                    {smsLength} chars · {smsSegments} SMS {smsSegments === 1 ? 'part' : 'parts'}
                  </span>
                </div>
              </div>
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => {
                  setCustomMessage(e.target.value);
                  setIsEdited(true);
                }}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 leading-relaxed focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  exportDefaulterSmsCsv(rows, profile, {
                    tierOverride: tierMode,
                    paymentChannelNote,
                  });
                  setCopiedField('bulk');
                  setTimeout(() => setCopiedField(null), 2400);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                {copiedField === 'bulk' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Downloaded All ({rows.length}) CSV
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-blue-700" />
                    Export All {rows.length} SMS Templates (CSV)
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(customMessage, 'sms')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700"
                >
                  {copiedField === 'sms' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied SMS Text!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy SMS Text
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
