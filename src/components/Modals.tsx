import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, Printer, QrCode, ShieldCheck, X } from 'lucide-react';
import type {
  ExpenseCategory,
  FeePayment,
  PaymentMethod,
  PayrollRecord,
  SchoolClass,
  SchoolProfile,
  StaffCategory,
  StaffMember,
  Student,
  StudentFeeSummary,
} from '../shared/types';
import { formatUGX, getAvailablePaymentTerms } from '../utils/schoolFinance';
import { buildReceiptQrPayload, generateReceiptQrDataUrl } from '../utils/receiptQr';
import { SchoolCrest } from './RoleAvatar';

function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className={`bg-white border border-slate-200 rounded-2xl w-full ${maxWidth} shadow-2xl overflow-hidden my-auto`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/70 no-print">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[82vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function AddClassModal({
  staff,
  onSubmit,
  onClose,
}: {
  staff: StaffMember[];
  onSubmit: (payload: {
    name: string;
    stream: string;
    room: string;
    capacity: number;
    classTeacherId: string;
    tuitionFee: number;
    lunchFee: number;
    activityFee: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [stream, setStream] = useState('Main');
  const [room, setRoom] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [classTeacherId, setClassTeacherId] = useState('');
  const [tuitionFee, setTuitionFee] = useState('');
  const [lunchFee, setLunchFee] = useState('0');
  const [activityFee, setActivityFee] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const teachers = staff.filter((s) => s.category === 'Teaching');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || tuitionFee === '' || Number(tuitionFee) < 0) {
      setError('Class name and valid term tuition in UGX are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        name: name.trim(),
        stream: stream.trim() || 'Main',
        room: room.trim() || 'Main Block',
        capacity: Number(capacity) || 40,
        classTeacherId,
        tuitionFee: Number(tuitionFee),
        lunchFee: Number(lunchFee) || 0,
        activityFee: Number(activityFee) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add class.');
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Create School Class & Fee Structure"
      subtitle="Define class name, capacity, and term fees in Ugandan Shillings (UGX)."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Class Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Primary 1 or Senior 1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Stream</label>
            <input
              type="text"
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              placeholder="e.g., East / North"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Room / Block</label>
            <input
              type="text"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Block A · Rm 1"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Capacity</label>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Class Teacher</label>
            <select
              value={classTeacherId}
              onChange={(e) => setClassTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Assign later</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Tuition (UGX)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={tuitionFee}
              onChange={(e) => setTuitionFee(e.target.value)}
              placeholder="650000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Meals / Lunch (UGX)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={lunchFee}
              onChange={(e) => setLunchFee(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Activity / Dev (UGX)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={activityFee}
              onChange={(e) => setActivityFee(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
          <span className="font-medium text-blue-950">Total Term Fee per Student (Tuition + Meals + Activity)</span>
          <span className="text-sm font-mono font-bold text-blue-800 tabular-nums">
            {formatUGX((Number(tuitionFee) || 0) + (Number(lunchFee) || 0) + (Number(activityFee) || 0))}
          </span>
        </div>

        {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Class'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function StudentDossierModal({
  profile,
  student,
  schoolClass,
  summary,
  onClose,
}: {
  profile: SchoolProfile;
  student: Student;
  schoolClass: SchoolClass | null;
  summary?: StudentFeeSummary;
  onClose: () => void;
}) {
  return (
    <ModalFrame
      title={`Student Admission File · ${student.admissionNo}`}
      subtitle={`Admitted ${student.admissionDate} · ${student.enrollmentStatus}`}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <SchoolCrest size="md" />
            <div>
              <div className="text-base font-bold text-slate-900">{student.fullName}</div>
              <div className="text-xs text-slate-500">
                {schoolClass ? `${schoolClass.name} (${schoolClass.stream})` : 'Unassigned Class'} · {student.boardingStatus}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Unique Student ID</div>
            <div className="text-sm font-mono font-bold text-blue-700">{student.admissionNo}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-900 pb-1 border-b border-slate-200">Personal Details</div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Gender</span>
              <span className="text-slate-900">{student.gender}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Date of Birth</span>
              <span className="font-mono text-slate-900">{student.dateOfBirth || 'Not recorded'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Nationality</span>
              <span className="text-slate-900">{student.nationality || 'Ugandan'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Home Address</span>
              <span className="text-slate-900 text-right">{student.homeAddress || 'Not recorded'}</span>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-900 pb-1 border-b border-slate-200">Guardian & Emergency</div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Primary Guardian</span>
              <span className="text-slate-900 font-medium text-right">
                {student.guardianName} ({student.guardianRelationship})
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Phone</span>
              <span className="font-mono text-slate-900">{student.guardianPhone}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-900 text-right truncate">{student.guardianEmail || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Emergency Contact</span>
              <span className="text-slate-900 text-right">
                {student.emergencyContactName ? `${student.emergencyContactName} (${student.emergencyContactPhone})` : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-900 pb-1 border-b border-slate-200">
              Previous Academic Performance
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Previous School</span>
              <span className="text-slate-900 text-right">{student.previousSchool || 'First-time enrollment'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Last Class</span>
              <span className="text-slate-900">{student.previousClass || '—'}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Prior Score / Grade</span>
              <span className="font-mono font-medium text-slate-900">{student.previousAcademicScore || '—'}</span>
            </div>
            {student.academicPerformanceNotes && (
              <p className="text-xs text-slate-600 pt-1">{student.academicPerformanceNotes}</p>
            )}
          </div>

          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-900 pb-1 border-b border-slate-200">
              Special Needs & Medical Support
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Special Needs Flagged</span>
              <span className={`font-medium ${student.hasSpecialNeeds ? 'text-amber-700' : 'text-emerald-700'}`}>
                {student.hasSpecialNeeds ? 'Yes — Support Required' : 'None Reported'}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {student.specialNeedsDetails || 'No special medical, dietary, or learning accommodations documented.'}
            </p>
          </div>
        </div>

        {summary && (
          <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-600">Net Term Billed ({profile.activeTerm})</div>
              <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                {formatUGX(summary.netBilled)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Total Paid</div>
              <div className="font-mono font-semibold text-emerald-700 tabular-nums mt-0.5">
                {formatUGX(summary.totalPaid)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600">Balance Remaining</div>
              <div className={`font-mono font-semibold tabular-nums mt-0.5 ${summary.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {formatUGX(summary.balance)}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
          >
            <Printer className="w-4 h-4" />
            Print Admission Dossier
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function RecordPaymentModal({
  studentSummaries,
  initialStudentId,
  activeTerm,
  recordedBy,
  onSubmit,
  onClose,
}: {
  studentSummaries: StudentFeeSummary[];
  initialStudentId?: string;
  activeTerm: string;
  recordedBy: string;
  onSubmit: (payload: {
    studentId: string;
    amount: number;
    method: PaymentMethod;
    paymentDate: string;
    term: string;
    recordedBy: string;
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const firstOwing =
    studentSummaries.find((s) => s.student.id === initialStudentId) ||
    studentSummaries.find((s) => s.balance > 0) ||
    studentSummaries[0];

  const [studentQuery, setStudentQuery] = useState('');
  const [studentId, setStudentId] = useState(firstOwing?.student.id || '');
  const filteredSummaries = studentQuery.trim()
    ? studentSummaries.filter((s) => {
        const q = studentQuery.trim().toLowerCase();
        return (
          s.student.fullName.toLowerCase().includes(q) ||
          s.student.admissionNo.toLowerCase().includes(q) ||
          (s.schoolClass?.name || '').toLowerCase().includes(q)
        );
      })
    : studentSummaries;

  const selected = studentSummaries.find((s) => s.student.id === studentId);
  const [amount, setAmount] = useState(selected ? String(selected.balance || selected.netBilled || '') : '');
  const [method, setMethod] = useState<PaymentMethod>('Bank Deposit');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState(activeTerm);
  const [notes, setNotes] = useState('School fees payment');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableTerms = getAvailablePaymentTerms(activeTerm);
  const numericAmount = Number(amount) || 0;
  const projectedBalance = selected ? Math.max(0, selected.balance - numericAmount) : 0;

  const handleStudentChange = (newId: string) => {
    setStudentId(newId);
    const match = studentSummaries.find((s) => s.student.id === newId);
    if (match) {
      setAmount(String(match.balance > 0 ? match.balance : match.netBilled));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!studentId || !Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter a valid amount greater than zero in UGX.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ studentId, amount: numeric, method, paymentDate, term, recordedBy, notes });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Collect School Fee Payment (UGX)"
      subtitle="Search for a student, enter the amount paid, and print an official receipt."
      onClose={onClose}
    >
      {studentSummaries.length === 0 ? (
        <div className="py-6 text-center space-y-3">
          <p className="text-sm text-slate-600">
            No students have been registered yet. Register a student first before collecting fees.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
          >
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">1. Find &amp; Choose Student</label>
            <input
              type="text"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              placeholder="Type student name, ID, or class to filter..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 bg-slate-50/70"
            />
            <select
              value={studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 bg-white"
            >
              {filteredSummaries.length === 0 ? (
                <option value="">No student matches &ldquo;{studentQuery}&rdquo;</option>
              ) : (
                filteredSummaries.map((s) => (
                  <option key={s.student.id} value={s.student.id}>
                    {s.student.fullName} · {s.schoolClass?.name || 'Unassigned'} ({s.student.admissionNo}) — Owes:{' '}
                    {formatUGX(s.balance)}
                  </option>
                ))
              )}
            </select>
          </div>

          {selected && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-xs">
                <div>
                  <div className="text-slate-600">Total Term Fee</div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5">
                    {formatUGX(selected.netBilled)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Already Paid</div>
                  <div className="font-mono font-semibold text-emerald-700 tabular-nums mt-0.5">
                    {formatUGX(selected.totalPaid)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-600">Balance Left</div>
                  <div className="font-mono font-semibold text-rose-700 tabular-nums mt-0.5">
                    {formatUGX(selected.balance)}
                  </div>
                </div>
              </div>
              {selected.riskProfile.riskLevel === 'High-Risk' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">
                      High-Risk Defaulter Flag ({selected.riskProfile.delayedTermsCount} terms delayed)
                    </div>
                    <div className="text-rose-800 mt-0.5">
                      Cumulative unpaid across terms: {formatUGX(selected.riskProfile.cumulativeArrears)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">2. Amount Paying Now (UGX)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">How Did They Pay?</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
              >
                <option value="Bank Deposit">Bank Deposit</option>
                <option value="Mobile Money">Mobile Money (MTN / Airtel)</option>
                <option value="Cash">Cash at School</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {selected && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {selected.balance > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAmount(String(selected.balance))}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                    >
                      Pay Full Balance
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmount(String(Math.round(selected.balance / 2)))}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100"
                    >
                      Pay Half (50%)
                    </button>
                  </>
                )}
                {[100000, 250000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="px-2.5 py-1 text-xs font-mono rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    {formatUGX(preset)}
                  </button>
                ))}
              </div>
              {numericAmount > 0 && (
                <div className="text-xs text-slate-600 flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span>Balance left after this payment:</span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      projectedBalance === 0 ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {projectedBalance === 0 ? 'UGX 0 (Paid in Full)' : formatUGX(projectedBalance)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Academic Term</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-900 bg-white"
              >
                {availableTerms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Bank Slip / Reference</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Receipt or Mobile Money ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !studentId}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving Payment...' : 'Save & Issue Receipt'}
            </button>
          </div>
        </form>
      )}
    </ModalFrame>
  );
}

export function ReceiptModal({
  profile,
  payment,
  summary,
  onClose,
}: {
  profile: SchoolProfile;
  payment: FeePayment;
  summary: StudentFeeSummary;
  onClose: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    let active = true;
    const payload = buildReceiptQrPayload(payment, summary.student);
    generateReceiptQrDataUrl(payload)
      .then((url) => {
        if (active) {
          setQrDataUrl(url);
          setQrError(false);
        }
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [payment, summary.student]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `${payment.receiptNo}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ModalFrame title="Official School Fee Receipt" subtitle={`Receipt ${payment.receiptNo}`} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <SchoolCrest size="md" />
            <div>
              <div className="text-base font-bold text-slate-900">{profile.schoolName}</div>
              <div className="text-xs text-slate-500">
                {profile.address} {profile.phone ? `· ${profile.phone}` : ''}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Receipt No.</div>
            <div className="text-sm font-mono font-semibold text-slate-900">{payment.receiptNo}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-2.5 text-sm">
          <div className="text-slate-500">Student Name</div>
          <div className="font-medium text-slate-900 text-right">{summary.student.fullName}</div>
          <div className="text-slate-500">Student ID &amp; Class</div>
          <div className="font-mono text-slate-900 text-right">
            {summary.student.admissionNo} · {summary.schoolClass?.name || '—'}
          </div>
          <div className="text-slate-500">Academic Term</div>
          <div className="text-slate-900 text-right">{payment.term}</div>
          <div className="text-slate-500">Payment Date &amp; Method</div>
          <div className="text-slate-900 text-right font-mono">
            {payment.paymentDate} · {payment.method}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Amount Received (This Receipt)</span>
            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
              {formatUGX(payment.amount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Total Term Fee Billed</span>
            <span className="font-mono text-slate-900 tabular-nums">{formatUGX(summary.netBilled)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Cumulative Paid to Date</span>
            <span className="font-mono text-slate-900 tabular-nums">{formatUGX(summary.totalPaid)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
            <span className="text-slate-900">Outstanding Balance</span>
            <span className={`font-mono tabular-nums ${summary.balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
              {formatUGX(summary.balance)}
            </span>
          </div>
        </div>

        {/* Scannable QR Verification Stamp */}
        <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-28 h-28 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Verification QR code for receipt ${payment.receiptNo}`}
                className="w-full h-full object-contain"
              />
            ) : qrError ? (
              <div className="text-[11px] text-center text-slate-400 px-2">QR unavailable</div>
            ) : (
              <QrCode className="w-8 h-8 text-slate-300 animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Instant QR Receipt Verification</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scan this QR code with a mobile camera or the Bursar QR Scanner to confirm receipt{' '}
              <span className="font-mono font-semibold text-slate-900">{payment.receiptNo}</span> and view live student ledger balances.
            </p>
            <div className="text-[11px] font-mono text-slate-500">
              ID: {summary.student.admissionNo} · Amount: {formatUGX(payment.amount)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>Recorded by: {payment.recordedBy}</span>
          <span>Remarks: {payment.notes || 'None'}</span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200 no-print">
          {qrDataUrl && (
            <button
              type="button"
              onClick={handleDownloadQr}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              Save QR Image
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function PayslipModal({
  profile,
  staff,
  payroll,
  onClose,
}: {
  profile: SchoolProfile;
  staff: StaffMember;
  payroll: PayrollRecord;
  onClose: () => void;
}) {
  return (
    <ModalFrame title="Staff Salary Payslip (UGX)" subtitle={`Voucher ${payroll.voucherNo} · ${payroll.month}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <SchoolCrest size="sm" />
            <div>
              <div className="text-sm font-bold text-slate-900">{profile.schoolName}</div>
              <div className="text-xs text-slate-500">Payroll Office · {payroll.month}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Voucher</div>
            <div className="text-xs font-mono font-semibold text-slate-900">{payroll.voucherNo}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="text-slate-500">Employee Name</div>
          <div className="font-medium text-slate-900 text-right">{staff.fullName}</div>
          <div className="text-slate-500">Employee ID & Category</div>
          <div className="text-slate-900 text-right font-mono">
            {staff.employeeNo} · {staff.category}
          </div>
          <div className="text-slate-500">Designation</div>
          <div className="text-slate-900 text-right">{staff.roleTitle}</div>
          <div className="text-slate-500">Bank / Mobile Account</div>
          <div className="text-slate-900 text-right font-mono">{staff.bankAccount}</div>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Base Salary</span>
            <span className="font-mono tabular-nums text-slate-900">{formatUGX(payroll.baseSalary)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Housing & Transport Allowances</span>
            <span className="font-mono tabular-nums text-emerald-700">+{formatUGX(payroll.allowances)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">PAYE Tax & NSSF Deductions</span>
            <span className="font-mono tabular-nums text-red-700">-{formatUGX(payroll.deductions)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-base">
            <span className="text-slate-900">Net Pay</span>
            <span className="font-mono tabular-nums text-slate-900">{formatUGX(payroll.netPay)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Status: {payroll.status}</span>
          <span>Paid Date: {payroll.paidDate || 'Pending Disbursement'}</span>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
          >
            <Printer className="w-4 h-4" />
            Print Payslip
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

export function RecordExpenseModal({
  approvalThresholdUgx,
  defaultRequestedBy,
  onSubmit,
  onClose,
}: {
  approvalThresholdUgx: number;
  defaultRequestedBy: string;
  onSubmit: (payload: {
    category: ExpenseCategory;
    description: string;
    vendor: string;
    amount: number;
    paymentMethod: PaymentMethod | 'Bank Transfer';
    requestedBy: string;
    date: string;
    notes: string;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('Food & Kitchen');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | 'Bank Transfer'>('Cash');
  const [requestedBy, setRequestedBy] = useState(defaultRequestedBy);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount);
    if (!vendor.trim() || !description.trim() || !Number.isFinite(numeric) || numeric <= 0) {
      setError('Vendor, description, and a positive UGX amount are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        category,
        vendor: vendor.trim(),
        description: description.trim(),
        amount: numeric,
        paymentMethod,
        requestedBy: requestedBy.trim(),
        date,
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Record School Expense / Requisition (UGX)"
      subtitle={`Expenses of ${formatUGX(approvalThresholdUgx)} or more are automatically queued for Owner approval.`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="Food & Kitchen">Food & Kitchen</option>
              <option value="Utilities">Utilities</option>
              <option value="Teaching Supplies">Teaching Supplies</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Transport & Fuel">Transport & Fuel</option>
              <option value="Administration">Administration</option>
              <option value="Capital & Equipment">Capital & Equipment</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Amount (UGX)</label>
            <input
              type="number"
              min="500"
              step="500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="250000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Vendor / Payee</label>
          <input
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Supplier or service provider name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Item / Purpose Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe goods or service purchased"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | 'Bank Transfer')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Requested By</label>
            <input
              type="text"
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Voucher / Invoice Notes (Optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery note or receipt number"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        {Number(amount) > 0 && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium ${
              Number(amount) >= approvalThresholdUgx
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {Number(amount) >= approvalThresholdUgx
              ? `Because this is ${formatUGX(approvalThresholdUgx)} or more, it will go to the School Owner for approval.`
              : `Under ${formatUGX(approvalThresholdUgx)} — this expense will be approved and posted immediately.`}
          </div>
        )}

        {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function AddStaffModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (payload: {
    fullName: string;
    category: StaffCategory;
    roleTitle: string;
    department: string;
    assignedClassesOrArea: string;
    phone: string;
    bankAccount: string;
    baseSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    taxDeduction: number;
    pensionDeduction: number;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [category, setCategory] = useState<StaffCategory>('Teaching');
  const [roleTitle, setRoleTitle] = useState('');
  const [department, setDepartment] = useState('Academics');
  const [assignedClassesOrArea, setAssignedClassesOrArea] = useState('');
  const [phone, setPhone] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [baseSalary, setBaseSalary] = useState('900000');
  const [housingAllowance, setHousingAllowance] = useState('150000');
  const [transportAllowance, setTransportAllowance] = useState('100000');
  const [taxDeduction, setTaxDeduction] = useState('95000');
  const [pensionDeduction, setPensionDeduction] = useState('45000');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !roleTitle.trim() || Number(baseSalary) <= 0) {
      setError('Full name, role title, and positive base salary in UGX are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        fullName: fullName.trim(),
        category,
        roleTitle: roleTitle.trim(),
        department: department.trim(),
        assignedClassesOrArea: assignedClassesOrArea.trim() || 'Campus General',
        phone: phone.trim(),
        bankAccount: bankAccount.trim(),
        baseSalary: Number(baseSalary),
        housingAllowance: Number(housingAllowance) || 0,
        transportAllowance: Number(transportAllowance) || 0,
        taxDeduction: Number(taxDeduction) || 0,
        pensionDeduction: Number(pensionDeduction) || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add staff member.');
      setSaving(false);
    }
  };

  return (
    <ModalFrame
      title="Onboard Teaching or Non-Teaching Staff (UGX)"
      subtitle="Adds staff member to the school directory and active monthly UGX payroll."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Staff member full name"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Staff Category</label>
            <select
              value={category}
              onChange={(e) => {
                const cat = e.target.value as StaffCategory;
                setCategory(cat);
                setDepartment(cat === 'Teaching' ? 'Academics' : 'Operations & Support');
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="Teaching">Teaching Staff</option>
              <option value="Non-Teaching">Non-Teaching Staff</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Role / Designation</label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder={category === 'Teaching' ? 'e.g., Mathematics Teacher' : 'e.g., Matron / Security'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Class / Duty Area</label>
            <input
              type="text"
              value={assignedClassesOrArea}
              onChange={(e) => setAssignedClassesOrArea(e.target.value)}
              placeholder="e.g., Primary 5 or Kitchen"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+256 772 ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Base Salary (UGX)</label>
            <input
              type="number"
              min="10000"
              step="5000"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Housing Allow.</label>
            <input
              type="number"
              min="0"
              step="5000"
              value={housingAllowance}
              onChange={(e) => setHousingAllowance(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Transport Allow.</label>
            <input
              type="number"
              min="0"
              step="5000"
              value={transportAllowance}
              onChange={(e) => setTransportAllowance(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">PAYE Tax Ded.</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={taxDeduction}
              onChange={(e) => setTaxDeduction(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">NSSF Ded.</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={pensionDeduction}
              onChange={(e) => setPensionDeduction(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Bank / Mobile Money</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              placeholder="Stanbic / Centenary / MTN"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
          <span className="font-medium text-emerald-950">Monthly Take-Home Salary (Base + Allowances - Deductions)</span>
          <span className="text-sm font-mono font-bold text-emerald-800 tabular-nums">
            {formatUGX(
              Math.max(
                0,
                (Number(baseSalary) || 0) +
                  (Number(housingAllowance) || 0) +
                  (Number(transportAllowance) || 0) -
                  (Number(taxDeduction) || 0) -
                  (Number(pensionDeduction) || 0)
              )
            )}
          </span>
        </div>

        {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Save Staff Member'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
