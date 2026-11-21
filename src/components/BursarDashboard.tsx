import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  MessageSquare,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  ExpenseCategory,
  FeePayment,
  PayrollRecord,
  SchoolDatabase,
  StaffCategory,
  StaffMember,
  StudentFeeSummary,
} from '../shared/types';
import {
  computeFinancialOverview,
  exportCashbookCsv,
  exportClassFeeSummaryCsv,
  exportDefaultersCsv,
  exportExpensesCsv,
  exportPayrollCsv,
  exportStudentFeeRecordsCsv,
  formatUGX,
} from '../utils/schoolFinance';
import { DefaulterSmsModal } from './DefaulterSmsModal';

export type BursarView = 'overview' | 'fees' | 'defaulters' | 'payroll' | 'ledger';
export type DefaulterScope = 'critical' | 'all_owing' | 'high_risk';

export function BursarDashboard({
  db,
  activeView,
  defaulterScopeRequest,
  onNavigate,
  onOpenExportModal,
  onOpenScannerModal,
  onOpenPaymentModal,
  onOpenReceiptModal,
  onOpenPayslipModal,
  onOpenExpenseModal,
  onOpenAddStaffModal,
  onPayPayroll,
  onUpdateStaffSalary,
}: {
  db: SchoolDatabase;
  activeView: BursarView;
  defaulterScopeRequest?: { scope: DefaulterScope; seq: number };
  onNavigate: (view: BursarView) => void;
  onOpenExportModal: () => void;
  onOpenScannerModal: () => void;
  onOpenPaymentModal: (studentId?: string) => void;
  onOpenReceiptModal: (payment: FeePayment, summary: StudentFeeSummary) => void;
  onOpenPayslipModal: (staff: StaffMember, payroll: PayrollRecord) => void;
  onOpenExpenseModal: () => void;
  onOpenAddStaffModal: () => void;
  onPayPayroll: (payload: { month: string; staffId?: string; category?: StaffCategory }) => Promise<void>;
  onUpdateStaffSalary: (staffId: string, baseSalary: number) => Promise<void>;
}) {
  const [selectedMonth, setSelectedMonth] = useState(db.profile.activeMonth);
  const fin = computeFinancialOverview(db, selectedMonth);

  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [feeStatusFilter, setFeeStatusFilter] = useState<'ALL' | 'Paid in Full' | 'Partial' | 'Defaulter'>('ALL');
  const [studentSearch, setStudentSearch] = useState('');

  const [defaulterScope, setDefaulterScope] = useState<DefaulterScope>('critical');
  const [defaulterClassFilter, setDefaulterClassFilter] = useState<string>('ALL');
  const [smsModalState, setSmsModalState] = useState<{ open: boolean; studentId?: string }>({ open: false });

  useEffect(() => {
    if (defaulterScopeRequest) {
      setDefaulterScope(defaulterScopeRequest.scope);
    }
  }, [defaulterScopeRequest]);

  const [payrollCategory, setPayrollCategory] = useState<'ALL' | StaffCategory>('ALL');
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [salaryDraft, setSalaryDraft] = useState<string>('');
  const [payingBusy, setPayingBusy] = useState(false);

  const [ledgerTab, setLedgerTab] = useState<'expenses' | 'cashbook'>('expenses');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<'ALL' | ExpenseCategory>('ALL');

  const handleBatchPay = async (category?: StaffCategory) => {
    setPayingBusy(true);
    try {
      await onPayPayroll({ month: selectedMonth, category });
    } finally {
      setPayingBusy(false);
    }
  };

  const handleSinglePay = async (staffId: string) => {
    setPayingBusy(true);
    try {
      await onPayPayroll({ month: selectedMonth, staffId });
    } finally {
      setPayingBusy(false);
    }
  };

  const handleSaveSalary = async (staffId: string) => {
    const num = Number(salaryDraft);
    if (!Number.isFinite(num) || num <= 0) return;
    await onUpdateStaffSalary(staffId, num);
    setEditingSalaryId(null);
  };

  // 1. STUDENT FEES & CLASS MATRIX VIEW
  if (activeView === 'fees') {
    const filteredStudents = fin.studentSummaries.filter((row) => {
      if (classFilter !== 'ALL' && row.student.classId !== classFilter) return false;
      if (feeStatusFilter !== 'ALL' && row.feeStatus !== feeStatusFilter) return false;
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        return (
          row.student.fullName.toLowerCase().includes(q) ||
          row.student.admissionNo.toLowerCase().includes(q) ||
          row.student.guardianName.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Student Fees &amp; Class Payment Matrix (UGX)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Inspect exact UGX totals per class and track how much each individual student has paid and owes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportClassFeeSummaryCsv(db)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              Class Summary CSV
            </button>
            <button
              type="button"
              onClick={() =>
                exportStudentFeeRecordsCsv(db, {
                  classId: classFilter,
                  status: feeStatusFilter,
                  search: studentSearch,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              Export Student Fees CSV
            </button>
            <button
              type="button"
              onClick={onOpenScannerModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              Scan Receipt QR
            </button>
            <button
              type="button"
              onClick={() => onOpenPaymentModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Fee Payment
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              Fee Collection by Class{' '}
              <span className="font-normal text-slate-500">(Click a class row to filter students below)</span>
            </h3>
            {classFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setClassFilter('ALL')}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Show All Classes
              </button>
            )}
          </div>
          {fin.classSummaries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No classes configured yet. Create classes in the Academic Registrar dashboard to start tracking class fees.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Class &amp; Stream</th>
                    <th className="py-2.5 px-4 text-right">Students</th>
                    <th className="py-2.5 px-4 text-right">Term Fee / Student</th>
                    <th className="py-2.5 px-4 text-right">Expected Total</th>
                    <th className="py-2.5 px-4 text-right">Paid Total</th>
                    <th className="py-2.5 px-4 text-right">Balance Owed</th>
                    <th className="py-2.5 px-4 text-right">Defaulters</th>
                    <th className="py-2.5 px-4 text-right">Collected %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {fin.classSummaries.map((cls) => {
                    const isSelected = classFilter === cls.schoolClass.id;
                    return (
                      <tr
                        key={cls.schoolClass.id}
                        onClick={() => setClassFilter(isSelected ? 'ALL' : cls.schoolClass.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {cls.schoolClass.name}{' '}
                          <span className="text-xs font-normal text-slate-500">· {cls.schoolClass.stream}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {cls.studentCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatUGX(cls.feePerStudent)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {formatUGX(cls.expectedTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-emerald-700">
                          {formatUGX(cls.collectedTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700">
                          {formatUGX(cls.outstandingTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {cls.defaulterCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  cls.collectionRate >= 80
                                    ? 'bg-emerald-600'
                                    : cls.collectionRate >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-600'
                                }`}
                                style={{ width: `${Math.min(100, cls.collectionRate)}%` }}
                              />
                            </div>
                            <span>{cls.collectionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'Paid in Full', 'Partial', 'Defaulter'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFeeStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    feeStatusFilter === status
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status === 'ALL' ? 'All Students' : status}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student or ID..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg w-52"
                />
              </div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Classes</option>
                {db.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4 text-right">Billed (UGX)</th>
                  <th className="py-2.5 px-4 text-right">Paid (UGX)</th>
                  <th className="py-2.5 px-4 text-right">Balance (UGX)</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      No admitted students match the selected class or fee filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((row) => {
                    const lastPayment = row.payments[0];
                    return (
                      <tr key={row.student.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{row.student.fullName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {row.student.admissionNo} · {row.student.guardianName}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">{row.schoolClass?.name || '—'}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatUGX(row.netBilled)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                          {formatUGX(row.totalPaid)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-red-700">
                          {formatUGX(row.balance)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className={`text-xs font-medium ${
                              row.feeStatus === 'Paid in Full'
                                ? 'text-emerald-700'
                                : row.feeStatus === 'Partial'
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }`}
                          >
                            {row.feeStatus} ({row.percentPaid}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {row.balance > 0 && (
                              <button
                                type="button"
                                onClick={() => onOpenPaymentModal(row.student.id)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
                              >
                                Collect Fee
                              </button>
                            )}
                            {lastPayment && (
                              <button
                                type="button"
                                onClick={() => onOpenReceiptModal(lastPayment, row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                              >
                                <Receipt className="w-3 h-3" />
                                Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 2. DEFAULTERS TRACKER VIEW
  if (activeView === 'defaulters') {
    const baseList =
      defaulterScope === 'high_risk'
        ? fin.highRiskDefaulters
        : defaulterScope === 'critical'
        ? fin.defaulterStudents
        : fin.allOwingStudents;
    const rows = baseList
      .filter((r) => (defaulterClassFilter === 'ALL' ? true : r.student.classId === defaulterClassFilter))
      .slice()
      .sort((a, b) =>
        defaulterScope === 'high_risk'
          ? b.riskProfile.riskScore - a.riskProfile.riskScore ||
            b.riskProfile.cumulativeArrears - a.riskProfile.cumulativeArrears
          : b.balance - a.balance
      );

    const totalFilteredArrears = rows.reduce(
      (s, r) => s + (defaulterScope === 'high_risk' ? r.riskProfile.cumulativeArrears : r.balance),
      0
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">School Fees Defaulters Tracker (UGX)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Track overdue {db.profile.activeTerm} balances, automated multi-term High-Risk alerts, and send guardian SMS reminders.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={rows.length === 0}
              onClick={() => setSmsModalState({ open: true })}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 disabled:opacity-50 whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Generate SMS Templates ({rows.length})
            </button>
            <button
              type="button"
              onClick={() =>
                exportDefaultersCsv(db, {
                  scope: defaulterScope,
                  classId: defaulterClassFilter,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-rose-700" />
              {defaulterScope === 'high_risk' ? 'Export High-Risk CSV' : 'Export Defaulters CSV'}
            </button>
            <button
              type="button"
              onClick={() => onOpenPaymentModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Automated Multi-Term High-Risk Alert Banner */}
        {fin.highRiskDefaulters.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-rose-950">
                  Automated Alert: {fin.highRiskDefaulters.length} High-Risk Multi-Term Defaulter
                  {fin.highRiskDefaulters.length === 1 ? '' : 's'} Flagged
                </div>
                <div className="text-xs text-rose-800 mt-0.5">
                  Students with recurring payment delays or unpaid balances across 2 or more terms require immediate guardian follow-up.
                </div>
              </div>
            </div>
            {defaulterScope !== 'high_risk' && (
              <button
                type="button"
                onClick={() => setDefaulterScope('high_risk')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl whitespace-nowrap"
              >
                View High-Risk List ({fin.highRiskDefaulters.length})
              </button>
            )}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setDefaulterScope('high_risk')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                defaulterScope === 'high_risk'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              High-Risk Defaulters ({fin.highRiskDefaulters.length})
            </button>
            <button
              type="button"
              onClick={() => setDefaulterScope('critical')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                defaulterScope === 'critical'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Critical Defaulters (&lt;60% Paid · {fin.defaulterStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setDefaulterScope('all_owing')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                defaulterScope === 'all_owing'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Unpaid Balances ({fin.allOwingStudents.length})
            </button>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={defaulterClassFilter}
              onChange={(e) => setDefaulterClassFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Classes</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-600">
              {defaulterScope === 'high_risk' ? 'Cumulative Arrears:' : 'Filtered Arrears:'}{' '}
              <span className="font-mono font-semibold text-red-700 tabular-nums">
                {formatUGX(totalFilteredArrears)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {defaulterScope === 'high_risk' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Student &amp; Class</th>
                    <th className="py-2.5 px-4">Guardian Contact</th>
                    <th className="py-2.5 px-4">Delayed Terms</th>
                    <th className="py-2.5 px-4">Recurring Delay Reasons</th>
                    <th className="py-2.5 px-4 text-right">Cumulative Arrears (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Risk Score</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        No students flagged with recurring multi-term payment delays right now.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.student.id} className="hover:bg-rose-50/30">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{r.student.fullName}</div>
                          <div className="text-xs font-mono text-slate-500">
                            {r.student.admissionNo} · {r.schoolClass?.name || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 text-xs font-medium">{r.student.guardianName}</div>
                          <div className="text-xs font-mono text-slate-500">{r.student.guardianPhone}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-rose-700 font-mono">
                            {r.riskProfile.delayedTermsCount} of {r.riskProfile.termsEvaluatedCount} terms delayed
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {r.riskProfile.unpaidTermsCount} unpaid · {r.riskProfile.latePaymentCount} late payment(s)
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5 text-xs text-slate-700">
                            {r.riskProfile.flagReasons.slice(0, 3).map((reason, idx) => (
                              <div key={idx} className="truncate" title={reason}>
                                &bull; {reason}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-mono tabular-nums font-bold text-rose-700">
                            {formatUGX(r.riskProfile.cumulativeArrears)}
                          </div>
                          {r.riskProfile.priorTermsArrears > 0 && (
                            <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                              Prior terms: {formatUGX(r.riskProfile.priorTermsArrears)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <span className="text-xs font-bold text-rose-700">{r.riskProfile.riskScore}/100</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSmsModalState({ open: true, studentId: r.student.id })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              SMS
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPaymentModal(r.student.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
                            >
                              Collect Fee
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Student &amp; ID</th>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4">Guardian Contact</th>
                    <th className="py-2.5 px-4 text-right">Billed (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Paid (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Balance Due (UGX)</th>
                    <th className="py-2.5 px-4 text-right">% Cleared</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-slate-500">
                        No fee defaulters found in this selection.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.student.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{r.student.fullName}</span>
                            {r.riskProfile.riskLevel === 'High-Risk' && (
                              <span className="text-[11px] font-semibold text-rose-700">
                                ({r.riskProfile.delayedTermsCount} terms delayed)
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-mono text-slate-500">{r.student.admissionNo}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.schoolClass?.name || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 text-xs font-medium">{r.student.guardianName}</div>
                          <div className="text-xs font-mono text-slate-500">{r.student.guardianPhone}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {formatUGX(r.netBilled)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                          {formatUGX(r.totalPaid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-red-700">
                          {formatUGX(r.balance)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-medium text-slate-700">
                          {r.percentPaid}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSmsModalState({ open: true, studentId: r.student.id })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              SMS
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPaymentModal(r.student.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
                            >
                              Collect Fee
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {smsModalState.open && (
          <DefaulterSmsModal
            profile={db.profile}
            rows={rows}
            initialStudentId={smsModalState.studentId}
            onClose={() => setSmsModalState({ open: false })}
          />
        )}
      </div>
    );
  }

  // 3. STAFF SALARIES & PAYROLL (TEACHING & NON-TEACHING)
  if (activeView === 'payroll') {
    const payrollMap = new Map(db.payroll.filter((p) => p.month === selectedMonth).map((p) => [p.staffId, p]));

    const staffRows = db.staff
      .filter((s) => (payrollCategory === 'ALL' ? true : s.category === payrollCategory))
      .map((member) => {
        const rec = payrollMap.get(member.id);
        const allowances = rec ? rec.allowances : member.housingAllowance + member.transportAllowance;
        const deductions = rec ? rec.deductions : member.taxDeduction + member.pensionDeduction;
        const netPay = rec ? rec.netPay : member.baseSalary + allowances - deductions;
        return {
          member,
          record: rec || {
            id: `payr_${selectedMonth}_${member.id}`,
            voucherNo: `SAL-${selectedMonth.replace('-', '')}-${member.employeeNo.replace('EMP-', '')}`,
            staffId: member.id,
            month: selectedMonth,
            baseSalary: member.baseSalary,
            allowances,
            deductions,
            netPay,
            status: 'Pending' as const,
            paidDate: null,
            paymentMethod: 'Bank Transfer' as const,
          },
        };
      });

    const pendingCount = staffRows.filter((r) => r.record.status === 'Pending').length;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Teaching &amp; Non-Teaching Staff Payroll (UGX)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage monthly UGX salaries, allowances, PAYE/NSSF deductions, and printable payslips for all personnel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="font-mono text-xs text-slate-900 focus:outline-none"
                aria-label="Select payroll month"
              />
            </label>
            <button
              type="button"
              onClick={onOpenAddStaffModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Staff Member
            </button>
            {pendingCount > 0 && (
              <button
                type="button"
                disabled={payingBusy}
                onClick={() => handleBatchPay(payrollCategory === 'ALL' ? undefined : payrollCategory)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
              >
                <Wallet className="w-3.5 h-3.5" />
                Disburse All Pending ({pendingCount})
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">Teaching Staff Payroll</div>
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-1.5">
              {formatUGX(fin.monthTeachingTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {db.staff.filter((s) => s.category === 'Teaching').length} teaching personnel
            </div>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">Non-Teaching Staff Payroll</div>
              <Users className="w-4 h-4 text-teal-700" />
            </div>
            <div className="text-xl font-mono font-bold text-slate-900 tabular-nums mt-1.5">
              {formatUGX(fin.monthNonTeachingTotal)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              {db.staff.filter((s) => s.category === 'Non-Teaching').length} support &amp; admin personnel
            </div>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">Disbursed ({selectedMonth})</div>
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xl font-mono font-bold text-emerald-700 tabular-nums mt-1.5">
              {formatUGX(fin.monthPayrollPaid)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">Paid via Bank / Mobile Money / Cash</div>
          </div>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-slate-500">Pending Payout ({selectedMonth})</div>
              <Wallet className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-xl font-mono font-bold text-amber-700 tabular-nums mt-1.5">
              {formatUGX(fin.monthPayrollPending)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">Remaining scheduled salaries</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'Teaching', 'Non-Teaching'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPayrollCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    payrollCategory === cat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'ALL' ? 'All Staff' : `${cat} Staff`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => exportPayrollCsv(db, selectedMonth, payrollCategory)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              Export Payroll CSV
            </button>
          </div>

          {staffRows.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm text-slate-500">
                No teaching or non-teaching staff added yet.
              </p>
              <button
                type="button"
                onClick={onOpenAddStaffModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add First Staff Member
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Category &amp; Role</th>
                    <th className="py-2.5 px-4 text-right">Base Salary</th>
                    <th className="py-2.5 px-4 text-right">Allowances</th>
                    <th className="py-2.5 px-4 text-right">Deductions</th>
                    <th className="py-2.5 px-4 text-right">Net Pay (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {staffRows.map(({ member, record }) => (
                    <tr key={member.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{member.fullName}</div>
                        <div className="text-xs font-mono text-slate-500">
                          {member.employeeNo} · {member.bankAccount}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="text-slate-900 text-xs font-medium">{member.roleTitle}</div>
                        <div className="text-xs text-slate-500">{member.category}</div>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {editingSalaryId === member.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              value={salaryDraft}
                              onChange={(e) => setSalaryDraft(e.target.value)}
                              className="w-28 px-1.5 py-0.5 text-xs border border-slate-300 rounded text-right font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSalary(member.id)}
                              className="text-xs text-emerald-700 font-medium hover:underline"
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSalaryId(member.id);
                              setSalaryDraft(String(member.baseSalary));
                            }}
                            title="Click to adjust base salary"
                            className="hover:underline"
                          >
                            {formatUGX(record.baseSalary)}
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                        +{formatUGX(record.allowances)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700">
                        -{formatUGX(record.deductions)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {formatUGX(record.netPay)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`text-xs font-medium ${
                            record.status === 'Paid' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {record.status === 'Pending' && (
                            <button
                              type="button"
                              disabled={payingBusy}
                              onClick={() => handleSinglePay(member.id)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                            >
                              Pay Now
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenPayslipModal(member, record)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                          >
                            <FileText className="w-3 h-3" />
                            Payslip
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. SCHOOL EXPENSES & UNIFIED CASHBOOK LEDGER
  if (activeView === 'ledger') {
    const filteredExpenses = db.expenses.filter((e) =>
      expenseCategoryFilter === 'ALL' ? true : e.category === expenseCategoryFilter
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">School Expenses &amp; General Cashbook (UGX)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Track every school expenditure and inspect the reconciled cashbook of all inflows and outflows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              All CSV Reports
            </button>
            <button
              type="button"
              onClick={() =>
                ledgerTab === 'expenses'
                  ? exportExpensesCsv(db, expenseCategoryFilter)
                  : exportCashbookCsv(db)
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              {ledgerTab === 'expenses' ? 'Export Expenses CSV' : 'Export Cashbook CSV'}
            </button>
            <button
              type="button"
              onClick={onOpenExpenseModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Expense
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setLedgerTab('expenses')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ledgerTab === 'expenses'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                School Expenses ({db.expenses.length})
              </button>
              <button
                type="button"
                onClick={() => setLedgerTab('cashbook')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  ledgerTab === 'cashbook'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unified Cashbook ({fin.cashbook.length} Entries)
              </button>
            </div>

            {ledgerTab === 'expenses' ? (
              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value as 'ALL' | ExpenseCategory)}
                className="py-1.5 px-3 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="ALL">All Expense Categories</option>
                <option value="Food & Kitchen">Food &amp; Kitchen</option>
                <option value="Utilities">Utilities</option>
                <option value="Teaching Supplies">Teaching Supplies</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Transport & Fuel">Transport &amp; Fuel</option>
                <option value="Administration">Administration</option>
                <option value="Capital & Equipment">Capital &amp; Equipment</option>
              </select>
            ) : (
              <div className="text-xs font-mono tabular-nums text-slate-600">
                Inflows: <span className="text-emerald-700 font-semibold">{formatUGX(fin.totalCollectedFees)}</span>
                {' · '}
                Outflows: <span className="text-red-700 font-semibold">{formatUGX(fin.totalTermOutflows)}</span>
              </div>
            )}
          </div>

          {ledgerTab === 'expenses' ? (
            filteredExpenses.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No expenses recorded yet. Click &ldquo;Record Expense&rdquo; to log a school purchase.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                      <th className="py-2.5 px-4">Voucher &amp; Date</th>
                      <th className="py-2.5 px-4">Category &amp; Vendor</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4 text-right">Amount (UGX)</th>
                      <th className="py-2.5 px-4 text-right">Approval / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4">
                          <div className="font-mono text-xs text-slate-900">{exp.voucherNo}</div>
                          <div className="font-mono text-xs text-slate-500 tabular-nums">{exp.date}</div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{exp.category}</div>
                          <div className="text-xs text-slate-500">{exp.vendor}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-sm">{exp.description}</td>
                        <td className="py-2.5 px-4 text-xs text-slate-600">{exp.paymentMethod}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {formatUGX(exp.amount)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-xs">
                          <div
                            className={`font-medium ${
                              exp.approvalStatus === 'Approved'
                                ? 'text-emerald-700'
                                : exp.approvalStatus === 'Pending Owner Approval'
                                ? 'text-amber-700'
                                : 'text-red-700'
                            }`}
                          >
                            {exp.approvalStatus}
                          </div>
                          <div className="text-slate-500">{exp.paidStatus}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : fin.cashbook.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No cashbook transactions yet. Fee inflows, salary payouts, and approved expenses will appear here automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Ref #</th>
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Party / Payee</th>
                    <th className="py-2.5 px-4">Category &amp; Method</th>
                    <th className="py-2.5 px-4 text-right">Inflow (+)</th>
                    <th className="py-2.5 px-4 text-right">Outflow (-)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {fin.cashbook.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-600">{entry.date}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{entry.reference}</td>
                      <td className="py-2.5 px-4 text-xs font-medium text-slate-900">{entry.type}</td>
                      <td className="py-2.5 px-4 text-slate-700">{entry.party}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-500">
                        {entry.category} · {entry.method}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {entry.inflow > 0 ? `+${formatUGX(entry.inflow)}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-700 font-medium">
                        {entry.outflow > 0 ? `-${formatUGX(entry.outflow)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. BURSAR OVERVIEW (Default)
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#0D9488] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            School Bursar Overview (UGX)
          </h2>
          <p className="text-xs sm:text-sm text-emerald-50">
            {db.profile.activeTerm} · Collect student fees, check who owes, pay salaries, and record expenses.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenScannerModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            Scan Receipt QR
          </button>
          <button
            type="button"
            onClick={onOpenExportModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={onOpenExpenseModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Expense
          </button>
          <button
            type="button"
            onClick={() => onOpenPaymentModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-200 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Collect Student Fee
          </button>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onOpenPaymentModal()}
          className="bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">1. Collect School Fees</div>
            <div className="text-xs text-slate-500 truncate">Receive money &amp; print receipt</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('defaulters')}
          className="bg-white border border-slate-200/90 hover:border-rose-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">2. See Who Owes Fees</div>
            <div className="text-xs text-slate-500 truncate">
              {fin.defaulterStudents.length} defaulters · {fin.highRiskDefaulters.length} high-risk
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('payroll')}
          className="bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">3. Pay Staff Salaries</div>
            <div className="text-xs text-slate-500 truncate">Teachers &amp; support staff payroll</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenExpenseModal}
          className="bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">4. Record Money Spent</div>
            <div className="text-xs text-slate-500 truncate">Food, bills, repairs &amp; cashbook</div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Fees Collected (Term)</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
            {formatUGX(fin.totalCollectedFees)}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, fin.feeCollectionRate)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {fin.feeCollectionRate}% of {formatUGX(fin.totalExpectedFees)} expected
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Fee Arrears &amp; Defaulters</div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-700 tabular-nums mt-1">
            {formatUGX(fin.totalFeeArrears)}
          </div>
          <div className="text-xs text-slate-500 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => onNavigate('defaulters')}
              className="text-rose-700 font-medium hover:underline"
            >
              {fin.defaulterStudents.length} critical defaulters &rarr;
            </button>
            {fin.highRiskDefaulters.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDefaulterScope('high_risk');
                  onNavigate('defaulters');
                }}
                className="text-rose-900 font-semibold hover:underline"
              >
                {fin.highRiskDefaulters.length} High-Risk (Multi-Term)
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Monthly Payroll ({selectedMonth})</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-800 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-indigo-950 tabular-nums mt-1">
            {formatUGX(fin.monthPayrollTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-3">
            <button
              type="button"
              onClick={() => onNavigate('payroll')}
              className="text-indigo-900 font-medium hover:underline"
            >
              Pending payout: {formatUGX(fin.monthPayrollPending)} &rarr;
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Approved Operating Expenses</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
            {formatUGX(fin.approvedPaidExpenses)}
          </div>
          <div className="text-xs text-slate-500 mt-3">
            {fin.pendingApprovalExpenses.length} awaiting Owner approval
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <h3 className="text-sm font-semibold text-slate-900">Priority Fee Defaulters</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('defaulters')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              View All Defaulters
            </button>
          </div>
          {fin.defaulterStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No priority fee defaulters currently on record.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {fin.defaulterStudents
                .slice()
                .sort((a, b) => b.balance - a.balance)
                .slice(0, 5)
                .map((r) => (
                  <div key={r.student.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{r.student.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {r.schoolClass?.name || '—'} · Paid {formatUGX(r.totalPaid)} ({r.percentPaid}%)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-mono font-semibold text-red-700 tabular-nums">
                          {formatUGX(r.balance)}
                        </div>
                        <div className="text-xs text-slate-500">Owed</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenPaymentModal(r.student.id)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
                      >
                        Collect
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-900">Recent Fee Receipts Issued</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenScannerModal}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                <QrCode className="w-3.5 h-3.5" />
                Verify QR
              </button>
              <button
                type="button"
                onClick={() => onNavigate('fees')}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Full Fee Ledger
              </button>
            </div>
          </div>
          {db.feePayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No fee payments recorded yet. Click &ldquo;Collect Student Fee&rdquo; to issue your first receipt.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {db.feePayments.slice(0, 5).map((pay) => {
                const summary = fin.studentSummaries.find((s) => s.student.id === pay.studentId);
                return (
                  <div key={pay.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {summary?.student.fullName || 'Student'}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {pay.receiptNo} · {summary?.schoolClass?.name || '—'} · {pay.paymentDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-mono font-semibold text-emerald-700 tabular-nums">
                          +{formatUGX(pay.amount)}
                        </div>
                        <div className="text-xs text-slate-500">{pay.method}</div>
                      </div>
                      {summary && (
                        <button
                          type="button"
                          onClick={() => onOpenReceiptModal(pay, summary)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                        >
                          Receipt
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
