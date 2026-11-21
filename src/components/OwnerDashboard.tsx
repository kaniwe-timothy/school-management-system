import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckSquare,
  Download,
  FileSpreadsheet,
  KeyRound,
  Landmark,
  Settings,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { AuthUser, DashboardRole, SchoolDatabase, SchoolProfile } from '../shared/types';
import {
  computeFinancialOverview,
  exportClassFeeSummaryCsv,
  exportIncomeExpenditureCsv,
  exportStudentFeeRecordsCsv,
  formatUGX,
} from '../utils/schoolFinance';
import { ROLE_PROFILES } from './RoleAvatar';

export type OwnerView = 'overview' | 'approvals' | 'pnl' | 'users' | 'settings';

export function OwnerDashboard({
  db,
  activeView,
  currentUserId,
  users,
  onNavigate,
  onOpenExportModal,
  onApproveExpense,
  onUpdateProfile,
  onRestoreBackup,
  onClearAllData,
  onCreateUser,
  onUpdateUser,
}: {
  db: SchoolDatabase;
  activeView: OwnerView;
  currentUserId: string;
  users: AuthUser[];
  onNavigate: (view: OwnerView) => void;
  onOpenExportModal: () => void;
  onApproveExpense: (expenseId: string, status: 'Approved' | 'Rejected') => Promise<void>;
  onUpdateProfile: (profile: Partial<SchoolProfile>) => Promise<void>;
  onRestoreBackup: (data: SchoolDatabase) => Promise<void>;
  onClearAllData: () => Promise<void>;
  onCreateUser: (payload: {
    fullName: string;
    username: string;
    role: DashboardRole;
    password: string;
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    patch: { isActive?: boolean; password?: string; role?: DashboardRole }
  ) => Promise<void>;
}) {
  const fin = computeFinancialOverview(db);

  const [profileForm, setProfileForm] = useState<SchoolProfile>(db.profile);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfileForm(db.profile);
  }, [db.profile]);

  const [newUserForm, setNewUserForm] = useState<{
    fullName: string;
    username: string;
    role: DashboardRole;
    password: string;
  }>({
    fullName: '',
    username: '',
    role: 'headteacher',
    password: '',
  });
  const [userFormError, setUserFormError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const handleDecision = async (id: string, status: 'Approved' | 'Rejected') => {
    setBusyId(id);
    try {
      await onApproveExpense(id, status);
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await onUpdateProfile(profileForm);
      setSettingsMsg('School profile and settings saved to SQL database.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `school-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SchoolDatabase;
      await onRestoreBackup(parsed);
      setProfileForm(parsed.profile);
      setSettingsMsg('Database backup restored successfully.');
    } catch {
      setSettingsMsg('Invalid backup JSON file.');
    }
  };

  if (activeView === 'approvals') {
    const pending = db.expenses.filter((e) => e.approvalStatus === 'Pending Owner Approval');
    const history = db.expenses.filter((e) => e.approvalStatus !== 'Pending Owner Approval');

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Owner Expenditure & Requisition Approvals</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              High-value school purchases ({formatUGX(db.profile.approvalThresholdUgx)}+) queued for proprietor sign-off.
            </p>
          </div>
          <div className="text-sm font-mono tabular-nums text-slate-700">
            Pending Value:{' '}
            <span className="font-semibold text-amber-700">{formatUGX(fin.pendingApprovalTotal)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Awaiting Your Decision ({pending.length})</h3>
          </div>
          {pending.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No pending expense requisitions awaiting approval.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Voucher</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Category & Vendor</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Requested By</th>
                    <th className="py-2.5 px-4 text-right">Amount (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {pending.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{exp.voucherNo}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">{exp.date}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{exp.category}</div>
                        <div className="text-xs text-slate-500">{exp.vendor}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs">{exp.description}</td>
                      <td className="py-3 px-4 text-slate-600 text-xs">{exp.requestedBy}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatUGX(exp.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === exp.id}
                            onClick={() => handleDecision(exp.id, 'Approved')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === exp.id}
                            onClick={() => handleDecision(exp.id, 'Rejected')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-slate-300 rounded-lg hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
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

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Reviewed Expenditure History ({history.length})</h3>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No reviewed expenses logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Voucher</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                    <th className="py-2.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {history.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{exp.voucherNo}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 tabular-nums">{exp.date}</td>
                      <td className="py-2.5 px-4 text-slate-900">{exp.category}</td>
                      <td className="py-2.5 px-4 text-slate-600 truncate max-w-md">{exp.description}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatUGX(exp.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`text-xs font-medium ${
                            exp.approvalStatus === 'Approved' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {exp.approvalStatus}
                        </span>
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

  if (activeView === 'pnl') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Termly Income & Expenditure Statement (UGX)</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Consolidated financial statement for {db.profile.activeTerm} covering all fees, salaries, and expenses in Ugandan Shillings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
              All CSV Reports
            </button>
            <button
              type="button"
              onClick={() => exportIncomeExpenditureCsv(db)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export P&amp;L Statement CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
              Revenue & Fee Receivables ({db.profile.activeTerm})
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gross Term Fees Billed ({fin.studentSummaries.length} Students)</span>
                <span className="font-mono tabular-nums text-slate-900">{formatUGX(fin.totalExpectedFees)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Actual Cash Fees Collected</span>
                <span className="font-mono font-semibold tabular-nums text-emerald-700">
                  {formatUGX(fin.totalCollectedFees)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Uncollected Arrears (Defaulters & Partial)</span>
                <span className="font-mono tabular-nums text-red-700">{formatUGX(fin.totalFeeArrears)}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200 font-semibold">
                <span className="text-slate-900">Fee Collection Efficiency</span>
                <span className="font-mono tabular-nums text-slate-900">{fin.feeCollectionRate}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
              Total School Expenditure (Payroll + Operations)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Teaching Staff Salaries (Term Disbursed)</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatUGX(fin.termTeachingPayrollPaid)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Non-Teaching Staff Salaries (Term Disbursed)</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatUGX(fin.termNonTeachingPayrollPaid)}
                </span>
              </div>
              {fin.expenseByCategory.map((cat) => (
                <div key={cat.category} className="flex justify-between">
                  <span className="text-slate-600">{cat.category}</span>
                  <span className="font-mono tabular-nums text-slate-900">{formatUGX(cat.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-slate-200 font-semibold">
                <span className="text-slate-900">Total Outflows Disbursed</span>
                <span className="font-mono tabular-nums text-slate-900">{formatUGX(fin.totalTermOutflows)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500">
              Net Term Cash Position (Collected Inflows - Total Outflows)
            </div>
            <div
              className={`text-2xl font-mono font-bold tabular-nums mt-1 ${
                fin.netCashSurplus >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {fin.netCashSurplus >= 0 ? '+' : ''}
              {formatUGX(fin.netCashSurplus)}
            </div>
          </div>
          <div className="text-sm text-slate-600 max-w-md">
            Collecting the remaining{' '}
            <span className="font-mono font-semibold text-slate-900">{formatUGX(fin.totalFeeArrears)}</span> in
            outstanding student fee balances will expand school operating reserves accordingly.
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'users') {
    const handleCreateUserSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setUserFormError('');
      setCreatingUser(true);
      try {
        await onCreateUser(newUserForm);
        setNewUserForm({ fullName: '', username: '', role: 'headteacher', password: '' });
      } catch (err) {
        setUserFormError(err instanceof Error ? err.message : 'Unable to create login account.');
      } finally {
        setCreatingUser(false);
      }
    };

    const handleResetPasswordSubmit = async (userId: string) => {
      if (resetPasswordVal.length < 6) {
        setUserFormError('New password must be at least 6 characters.');
        return;
      }
      setUserFormError('');
      setBusyId(userId);
      try {
        await onUpdateUser(userId, { password: resetPasswordVal });
        setResetUserId(null);
        setResetPasswordVal('');
      } catch (err) {
        setUserFormError(err instanceof Error ? err.message : 'Unable to reset password.');
      } finally {
        setBusyId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Staff Login Accounts &amp; Role Access</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage local sign-in credentials for your Head Teacher / Headmaster, School Bursar, and Academic Registrar.
          </p>
        </div>

        <form onSubmit={handleCreateUserSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-3 border-b border-slate-200">
            <UserPlus className="w-4 h-4 text-blue-700" />
            <span>Create New Leadership / Staff Login</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                placeholder="e.g., Patrick Mugisha"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Username *</label>
              <input
                type="text"
                required
                value={newUserForm.username}
                onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                placeholder="e.g., headteacher"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assigned Dashboard Role *</label>
              <select
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as DashboardRole })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="headteacher">Head Teacher / Headmaster</option>
                <option value="bursar">School Bursar</option>
                <option value="registrar">Academic Registrar</option>
                <option value="owner">School Owner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Initial Password (min 6) *</label>
              <input
                type="password"
                required
                minLength={6}
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Min 6 characters"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {userFormError && <p className="text-xs text-red-700 font-medium">{userFormError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creatingUser}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {creatingUser ? 'Creating Login...' : 'Create Login Account'}
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Registered Login Accounts ({users.length})</h3>
            <span className="text-xs text-slate-500">Stored locally in SQLite</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-4">Staff Member</th>
                  <th className="py-2.5 px-4">Username</th>
                  <th className="py-2.5 px-4">Dashboard Role</th>
                  <th className="py-2.5 px-4">Last Sign In</th>
                  <th className="py-2.5 px-4">Account Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {users.map((u) => {
                  const isSelf = u.id === currentUserId;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {u.fullName} {isSelf && <span className="text-xs text-blue-700">(You)</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{u.username}</td>
                      <td className="py-3 px-4 text-slate-700">{ROLE_PROFILES[u.role].roleLabel}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums">
                        {u.lastLoginAt ? u.lastLoginAt.slice(0, 16).replace('T', ' ') : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold ${u.isActive ? 'text-emerald-700' : 'text-red-700'}`}>
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {resetUserId === u.id ? (
                          <div className="inline-flex items-center gap-2">
                            <input
                              type="password"
                              value={resetPasswordVal}
                              onChange={(e) => setResetPasswordVal(e.target.value)}
                              placeholder="New password (min 6)"
                              className="w-40 rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                            />
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => handleResetPasswordSubmit(u.id)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetUserId(null);
                                setResetPasswordVal('');
                              }}
                              className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setResetUserId(u.id);
                                setResetPasswordVal('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              <KeyRound className="w-3 h-3" />
                              Reset Password
                            </button>
                            {!isSelf && (
                              <button
                                type="button"
                                disabled={busyId === u.id}
                                onClick={async () => {
                                  setBusyId(u.id);
                                  try {
                                    await onUpdateUser(u.id, { isActive: !u.isActive });
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${
                                  u.isActive
                                    ? 'text-red-700 border-slate-300 bg-white hover:bg-red-50'
                                    : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                }`}
                              >
                                {u.isActive ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">School Profile & Database Backup</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure school details, active academic term, UGX approval threshold, and database backups.
          </p>
        </div>

        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">School Name</label>
              <input
                type="text"
                value={profileForm.schoolName}
                onChange={(e) => setProfileForm({ ...profileForm, schoolName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">School Motto</label>
              <input
                type="text"
                value={profileForm.motto}
                onChange={(e) => setProfileForm({ ...profileForm, motto: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Campus Address</label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Official Phone</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+256 ..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="office@school.ac.ug"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Active Term</label>
              <input
                type="text"
                value={profileForm.activeTerm}
                onChange={(e) => setProfileForm({ ...profileForm, activeTerm: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Owner Approval Threshold (UGX)
              </label>
              <input
                type="number"
                min="10000"
                step="10000"
                value={profileForm.approvalThresholdUgx}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, approvalThresholdUgx: Number(e.target.value) || 500000 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          {settingsMsg && <p className="text-xs font-medium text-emerald-700">{settingsMsg}</p>}

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save School Settings'}
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">SQL Database Backup & Restore</h3>
          <p className="text-xs text-slate-500">
            Export your complete SQLite school database (students, classes, fees, payroll, and expenses) to JSON or restore from a previous backup.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Restore From Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportJson}
              className="hidden"
            />
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-700 bg-white border border-slate-300 rounded-lg hover:bg-red-50 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All Records
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 ml-auto">
                <span className="text-xs text-red-700 font-medium">Confirm permanent wipe?</span>
                <button
                  type="button"
                  onClick={async () => {
                    await onClearAllData();
                    setConfirmClear(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 rounded-lg hover:bg-red-800"
                >
                  Yes, Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default Owner Overview
  const maxOutflow = Math.max(
    fin.termTeachingPayrollPaid,
    fin.termNonTeachingPayrollPaid,
    ...fin.expenseByCategory.map((e) => e.amount),
    1
  );

  return (
    <div className="space-y-6">
      {/* Executive Welcome Banner */}
      <div className="bg-gradient-to-r from-[#132968] via-[#1D4ED8] to-[#2563EB] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            School Owner Overview
          </h2>
          <p className="text-xs sm:text-sm text-sky-100">
            {db.profile.schoolName} · {db.profile.activeTerm} · {fin.studentSummaries.length} Students ·{' '}
            {db.staff.length} Staff (UGX)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenExportModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Reports
          </button>
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-200 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            Review Approvals ({fin.pendingApprovalExpenses.length})
          </button>
        </div>
      </div>

      {/* Quick Actions Bar — Easy 1-Click Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('approvals')}
          className="bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">1. Approve Expenses</div>
            <div className="text-xs text-slate-500 truncate">
              {fin.pendingApprovalExpenses.length} waiting for your sign-off
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pnl')}
          className="bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">2. Money In vs. Out</div>
            <div className="text-xs text-slate-500 truncate">See term profit &amp; loss (UGX)</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('users')}
          className="bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">3. Staff User Logins</div>
            <div className="text-xs text-slate-500 truncate">Add Head Teacher, Bursar, Registrar</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="bg-white border border-slate-200/90 hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-100 to-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">4. School Name &amp; Backup</div>
            <div className="text-xs text-slate-500 truncate">Edit details or save backup file</div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Total Fees Collected</div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
            {formatUGX(fin.totalCollectedFees)}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, fin.feeCollectionRate)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 font-mono tabular-nums">
              {fin.feeCollectionRate}% of {formatUGX(fin.totalExpectedFees)} billed
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Fees Still Unpaid</div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-700 tabular-nums mt-1">
            {formatUGX(fin.totalFeeArrears)}
          </div>
          <div className="text-xs text-slate-500 mt-3">
            {fin.defaulterStudents.length} critical defaulters · {fin.allOwingStudents.length} owing
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Monthly Staff Salaries</div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-blue-950 tabular-nums mt-1">
            {formatUGX(fin.monthPayrollTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-3 font-mono tabular-nums">
            Teachers {formatUGX(fin.monthTeachingTotal)} · Support {formatUGX(fin.monthNonTeachingTotal)}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Cash Left in Account</div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                fin.netCashSurplus >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-mono font-bold tabular-nums mt-1 ${
              fin.netCashSurplus >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {fin.netCashSurplus >= 0 ? '+' : ''}
            {formatUGX(fin.netCashSurplus)}
          </div>
          <div className="text-xs text-slate-500 mt-3 font-mono tabular-nums">
            Total Spent: {formatUGX(fin.totalTermOutflows)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Term Outflows by Cost Center (UGX)</h3>
            <button
              type="button"
              onClick={() => onNavigate('pnl')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              View Full P&amp;L
            </button>
          </div>
          {fin.totalTermOutflows === 0 && fin.expenseByCategory.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No salary disbursements or approved expenses recorded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3.5">
              {[
                { label: 'Teaching Staff Salaries (Term)', amount: fin.termTeachingPayrollPaid, color: 'bg-blue-700' },
                {
                  label: 'Non-Teaching Staff Salaries (Term)',
                  amount: fin.termNonTeachingPayrollPaid,
                  color: 'bg-teal-700',
                },
                ...fin.expenseByCategory.map((c) => ({
                  label: c.category,
                  amount: c.amount,
                  color: 'bg-slate-600',
                })),
              ].map((row) => {
                const pct = row.amount > 0 ? Math.max(4, Math.round((row.amount / maxOutflow) * 100)) : 0;
                return (
                  <div key={row.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {formatUGX(row.amount)}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Pending Owner Approvals</h3>
            <span className="text-xs font-mono text-amber-700 font-semibold">
              {fin.pendingApprovalExpenses.length} open
            </span>
          </div>
          <div className="mt-3 divide-y divide-slate-200 flex-1">
            {fin.pendingApprovalExpenses.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">No requisitions awaiting sign-off.</div>
            ) : (
              fin.pendingApprovalExpenses.map((exp) => (
                <div key={exp.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{exp.description}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {exp.category} · {exp.vendor} · {exp.requestedBy}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                      {formatUGX(exp.amount)}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1.5">
                      <button
                        type="button"
                        disabled={busyId === exp.id}
                        onClick={() => handleDecision(exp.id, 'Approved')}
                        className="text-xs font-medium text-emerald-700 hover:underline"
                      >
                        Approve
                      </button>
                      <span className="text-slate-300">/</span>
                      <button
                        type="button"
                        disabled={busyId === exp.id}
                        onClick={() => handleDecision(exp.id, 'Rejected')}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {fin.pendingApprovalExpenses.length > 0 && (
            <div className="pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Items above {formatUGX(db.profile.approvalThresholdUgx)} require Proprietor sign-off.</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Class-by-Class Fee Collection Standing</h3>
            <span className="text-xs text-slate-500">{db.classes.length} active classes · {db.profile.activeTerm}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportStudentFeeRecordsCsv(db)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              Student Fees CSV
            </button>
            <button
              type="button"
              onClick={() => exportClassFeeSummaryCsv(db)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              Class Summary CSV
            </button>
          </div>
        </div>
        {fin.classSummaries.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No classes created yet. Use the Academic Registrar dashboard to create classes and admit students.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-4">Class</th>
                  <th className="py-2.5 px-4 text-right">Students</th>
                  <th className="py-2.5 px-4 text-right">Expected Fees</th>
                  <th className="py-2.5 px-4 text-right">Collected</th>
                  <th className="py-2.5 px-4 text-right">Outstanding</th>
                  <th className="py-2.5 px-4 text-right">Defaulters</th>
                  <th className="py-2.5 px-4 text-right">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {fin.classSummaries.map((cls) => (
                  <tr key={cls.schoolClass.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {cls.schoolClass.name}{' '}
                      <span className="text-xs font-normal text-slate-500">· {cls.schoolClass.stream}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">{cls.studentCount}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatUGX(cls.expectedTotal)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
