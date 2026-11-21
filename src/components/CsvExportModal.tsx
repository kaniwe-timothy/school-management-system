import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Receipt,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { SchoolDatabase } from '../shared/types';
import {
  computeFinancialOverview,
  exportCashbookCsv,
  exportClassFeeSummaryCsv,
  exportDefaultersCsv,
  exportExpensesCsv,
  exportFeePaymentsCsv,
  exportIncomeExpenditureCsv,
  exportPayrollCsv,
  exportStudentFeeRecordsCsv,
  formatUGX,
  getFilteredStudentFeeRows,
  type StudentFeeExportStatusFilter,
} from '../utils/schoolFinance';

export function CsvExportModal({
  db,
  onClose,
  onExported,
}: {
  db: SchoolDatabase;
  onClose: () => void;
  onExported?: (message: string) => void;
}) {
  const [classId, setClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StudentFeeExportStatusFilter>('ALL');
  const [payrollMonth, setPayrollMonth] = useState<string>(db.profile.activeMonth);
  const [lastDownload, setLastDownload] = useState<{ filename: string; rowCount: number } | null>(null);

  const fin = useMemo(() => computeFinancialOverview(db, payrollMonth), [db, payrollMonth]);

  const filteredFeeRows = useMemo(
    () => getFilteredStudentFeeRows(db, { classId, status: statusFilter }),
    [db, classId, statusFilter]
  );

  const filteredPaidTotal = useMemo(
    () => filteredFeeRows.reduce((sum, r) => sum + r.totalPaid, 0),
    [filteredFeeRows]
  );

  const filteredBalanceTotal = useMemo(
    () => filteredFeeRows.reduce((sum, r) => sum + r.balance, 0),
    [filteredFeeRows]
  );

  const matchingPaymentsCount = useMemo(() => {
    if (classId === 'ALL') return db.feePayments.length;
    const studentIds = new Set(db.students.filter((s) => s.classId === classId).map((s) => s.id));
    return db.feePayments.filter((p) => studentIds.has(p.studentId)).length;
  }, [db.feePayments, db.students, classId]);

  const matchingDefaultersCount = useMemo(() => {
    return fin.allOwingStudents.filter((r) => (classId === 'ALL' ? true : r.student.classId === classId)).length;
  }, [fin.allOwingStudents, classId]);

  const triggerDownload = (result: { filename: string; rowCount: number }) => {
    setLastDownload(result);
    onExported?.(`Exported ${result.filename} (${result.rowCount} rows) for external record-keeping.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-[#0B1437] via-[#132257] to-[#1E3A8A] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold truncate">Export CSV Reports &amp; Student Fee Records</h3>
              <p className="text-xs text-blue-100 truncate">
                Download Excel-ready CSV files for {db.profile.schoolName} ({db.profile.activeTerm}) in UGX
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {lastDownload && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="truncate">
                  Downloaded <span className="font-mono font-semibold">{lastDownload.filename}</span> (
                  {lastDownload.rowCount} records)
                </span>
              </div>
              <span className="text-emerald-700 font-medium shrink-0">Ready for Excel</span>
            </div>
          )}

          {/* Section 1: Student Fee Records */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">1. Student Fee Records (CSV)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter by class or payment status before downloading student fee records and payment receipts.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter CSV export by class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="ALL">All Classes ({db.classes.length})</option>
                  {db.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} · {cls.stream}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter CSV export by fee status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StudentFeeExportStatusFilter)}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700"
                >
                  <option value="ALL">All Payment Statuses</option>
                  <option value="Owing">Owing Any Balance</option>
                  <option value="Defaulter">Critical Defaulters (&lt;60%)</option>
                  <option value="Partial">Partial Payment (60–99%)</option>
                  <option value="Paid in Full">Paid in Full (100%)</option>
                </select>
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Matching Students:{' '}
                <strong className="font-mono text-slate-900 tabular-nums">{filteredFeeRows.length}</strong>
              </span>
              <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                <span>
                  Paid: <strong className="text-emerald-700">{formatUGX(filteredPaidTotal)}</strong>
                </span>
                <span>
                  Balance Owed: <strong className="text-rose-700">{formatUGX(filteredBalanceTotal)}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Student Fee Balances &amp; Status</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Per-student billed, paid, balance owed, guardian phone &amp; last receipt ({filteredFeeRows.length}{' '}
                      students).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportStudentFeeRecordsCsv(db, { classId, status: statusFilter }))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Student Fees CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-emerald-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Fee Payment Receipts Log</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Every payment transaction with receipt #, date, method &amp; UGX amount ({matchingPaymentsCount}{' '}
                      receipts).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportFeePaymentsCsv(db, { classId }))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Receipts CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-rose-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Fee Defaulters Follow-Up List</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      All owing students sorted by highest UGX arrears with parent contacts ({matchingDefaultersCount}{' '}
                      owing).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportDefaultersCsv(db, { scope: 'all_owing', classId }))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Defaulters CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-teal-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Class-by-Class Fee Summary</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Expected, collected, balance owed &amp; collection % for each class ({db.classes.length} classes).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportClassFeeSummaryCsv(db))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Class Summary CSV
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Reports */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">2. School Financial Reports (CSV)</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accounting statements, unified cashbook, expense vouchers, and staff salary schedules in UGX.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Payroll Month:</span>
                <input
                  type="month"
                  value={payrollMonth}
                  onChange={(e) => e.target.value && setPayrollMonth(e.target.value)}
                  className="font-mono text-xs text-slate-900 focus:outline-none"
                  aria-label="Select payroll month for export"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Term Income &amp; Expenditure (P&amp;L)</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Fees collected vs. staff salaries &amp; operating expenses. Net:{' '}
                      <span className="font-mono font-medium text-slate-800">{formatUGX(fin.netCashSurplus)}</span>.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportIncomeExpenditureCsv(db))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download P&amp;L Statement CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Unified Cashbook (Money In &amp; Out)</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Chronological inflows, salary payouts &amp; approved expenses with running balance ({fin.cashbook.length}{' '}
                      entries).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportCashbookCsv(db))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Cashbook CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-amber-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">School Expenses &amp; Approvals Log</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      All expenditure vouchers, vendors, requested by &amp; approval status ({db.expenses.length}{' '}
                      expenses).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportExpensesCsv(db))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Expenses CSV
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Staff Salaries Payroll ({payrollMonth})</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Teaching &amp; non-teaching base pay, allowances, deductions &amp; net pay ({db.staff.length}{' '}
                      staff).
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => triggerDownload(exportPayrollCsv(db, payrollMonth))}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Payroll CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            All CSV files include UTF-8 formatting and open cleanly in Microsoft Excel, LibreOffice, and Google Sheets.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
