/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  Check,
  CheckSquare,
  ClipboardList,
  CreditCard,
  Download,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Plus,
  QrCode,
  Search,
  Settings,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AuthStatusResponse,
  AuthUser,
  DashboardRole,
  EnrollmentStatus,
  ExpenseCategory,
  FeePayment,
  PaymentMethod,
  PayrollRecord,
  SchoolClass,
  SchoolDatabase,
  SchoolProfile,
  StaffCategory,
  StaffMember,
  Student,
  StudentFeeSummary,
} from './shared/types';
import { ROLE_PROFILES, RoleAvatar, SchoolCrest } from './components/RoleAvatar';
import { AuthGate } from './components/AuthGate';
import { OwnerDashboard, type OwnerView } from './components/OwnerDashboard';
import { HeadTeacherDashboard, type HeadTeacherView } from './components/HeadTeacherDashboard';
import { BursarDashboard, type BursarView, type DefaulterScope } from './components/BursarDashboard';
import { RegistrarDashboard, type RegistrarView } from './components/RegistrarDashboard';
import {
  AddClassModal,
  AddStaffModal,
  PayslipModal,
  ReceiptModal,
  RecordExpenseModal,
  RecordPaymentModal,
  StudentDossierModal,
} from './components/Modals';
import { StudentAdmissionModal, type AdmissionPayload } from './components/StudentAdmissionModal';
import { CsvExportModal } from './components/CsvExportModal';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import {
  AlertTriangle as QFAlertTriangle,
  Banknote as QFBanknote,
  BookOpen as QFBookOpen,
  CheckSquare as QFCheckSquare,
  CreditCard as QFCreditCard,
  FileSpreadsheet as QFFileSpreadsheet,
  KeyRound as QFKeyRound,
  QuickFinderModal,
  Settings as QFSettings,
  UserPlus as QFUserPlus,
  Wallet as QFWallet,
  type QuickActionItem,
} from './components/QuickFinderModal';
import { computeFinancialOverview, computeStudentFeeSummaries, formatUGX } from './utils/schoolFinance';
import { parseScannedReceiptQr, type ParsedReceiptQr } from './utils/receiptQr';

type ActiveModal =
  | { type: 'none' }
  | { type: 'record_payment'; studentId?: string }
  | { type: 'receipt'; payment: FeePayment; summary: StudentFeeSummary }
  | { type: 'scan_receipt'; initialQrInput?: ParsedReceiptQr }
  | { type: 'payslip'; staff: StaffMember; payroll: PayrollRecord }
  | { type: 'record_expense' }
  | { type: 'add_staff' }
  | { type: 'add_class' }
  | { type: 'admit_student' }
  | { type: 'student_dossier'; student: Student }
  | { type: 'csv_exports' }
  | { type: 'change_password' };

const ALLOWED_ROLES_BY_USER: Record<DashboardRole, DashboardRole[]> = {
  owner: ['owner', 'headteacher', 'bursar', 'registrar'],
  headteacher: ['headteacher', 'registrar'],
  bursar: ['bursar'],
  registrar: ['registrar'],
};

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [usersList, setUsersList] = useState<AuthUser[]>([]);

  const [db, setDb] = useState<SchoolDatabase | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const [role, setRole] = useState<DashboardRole>('owner');
  const [ownerView, setOwnerView] = useState<OwnerView>('overview');
  const [headView, setHeadView] = useState<HeadTeacherView>('overview');
  const [bursarView, setBursarView] = useState<BursarView>('overview');
  const [registrarView, setRegistrarView] = useState<RegistrarView>('admissions');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickFinderOpen, setQuickFinderOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [acknowledgedRiskIds, setAcknowledgedRiskIds] = useState<string[]>([]);
  const [sessionAlertShown, setSessionAlertShown] = useState(false);
  const [defaulterScopeRequest, setDefaulterScopeRequest] = useState<
    { scope: DefaulterScope; seq: number } | undefined
  >(undefined);
  const [pendingVerifyQr, setPendingVerifyQr] = useState<ParsedReceiptQr | null>(() => {
    if (typeof window === 'undefined' || !window.location.search) return null;
    const params = new URLSearchParams(window.location.search);
    if (!params.get('verifyReceipt') && !params.get('receipt')) return null;
    return parseScannedReceiptQr(window.location.search);
  });
  const [modal, setModal] = useState<ActiveModal>({ type: 'none' });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickFinderOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!db || !currentUser || sessionAlertShown) return;
    if (!ALLOWED_ROLES_BY_USER[currentUser.role].includes('bursar')) return;
    const flagged = computeFinancialOverview(db).highRiskDefaulters;
    if (flagged.length > 0) {
      showToast(
        `Automated Alert: ${flagged.length} student${flagged.length === 1 ? '' : 's'} flagged as High-Risk Defaulter${
          flagged.length === 1 ? '' : 's'
        } for recurring multi-term delays.`,
        'error'
      );
    }
    setSessionAlertShown(true);
  }, [db, currentUser, sessionAlertShown, showToast]);

  useEffect(() => {
    if (!db || !currentUser || !pendingVerifyQr) return;
    if (!ALLOWED_ROLES_BY_USER[currentUser.role].includes('bursar')) return;
    setRole('bursar');
    setBursarView('fees');
    setModal({ type: 'scan_receipt', initialQrInput: pendingVerifyQr });
    setPendingVerifyQr(null);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [db, currentUser, pendingVerifyQr]);

  const fetchAuthStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/status');
      if (!res.ok) throw new Error('Unable to connect to local SQLite server.');
      const data = (await res.json()) as AuthStatusResponse;
      setAuthStatus(data);
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Connection error.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  const fetchSchoolData = useCallback(
    async (tokenOverride?: string, userOverride?: AuthUser) => {
      const activeToken = tokenOverride ?? authToken;
      const activeUser = userOverride ?? currentUser;
      if (!activeToken || !activeUser) return;

      setLoading(true);
      try {
        const res = await fetch('/api/school', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.status === 401) {
          setAuthToken(null);
          setCurrentUser(null);
          setDb(null);
          await fetchAuthStatus();
          return;
        }
        if (!res.ok) throw new Error('Unable to load SQL school database.');
        const data = (await res.json()) as SchoolDatabase;
        setDb(data);
        setLoadError('');

        if (activeUser.role === 'owner') {
          const uRes = await fetch('/api/users', {
            headers: { Authorization: `Bearer ${activeToken}` },
          });
          if (uRes.ok) {
            const uData = (await uRes.json()) as { users: AuthUser[] };
            setUsersList(uData.users);
          }
        } else {
          setUsersList([]);
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Connection error.');
      } finally {
        setLoading(false);
      }
    },
    [authToken, currentUser, fetchAuthStatus]
  );

  const handleAuthenticated = async (token: string, user: AuthUser) => {
    setAuthToken(token);
    setCurrentUser(user);
    setRole(user.role);
    setAuthStatus((prev) => (prev ? { ...prev, requiresInitialSetup: false } : prev));
    await fetchSchoolData(token, user);
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${authToken}` },
        });
      } catch {
        // ignore network error during logout
      }
    }
    setAuthToken(null);
    setCurrentUser(null);
    setDb(null);
    setUsersList([]);
    setAlertsOpen(false);
    setAcknowledgedRiskIds([]);
    setSessionAlertShown(false);
    setModal({ type: 'none' });
    await fetchAuthStatus();
  };

  async function apiRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (res.status === 401) {
      setAuthToken(null);
      setCurrentUser(null);
      setDb(null);
      await fetchAuthStatus();
      throw new Error(data?.error || 'Session expired. Please sign in again.');
    }
    if (!res.ok) {
      throw new Error(data?.error || 'Request failed');
    }
    return data as T;
  }

  const handleAddClass = async (payload: {
    name: string;
    stream: string;
    room: string;
    capacity: number;
    classTeacherId: string;
    tuitionFee: number;
    lunchFee: number;
    activityFee: number;
  }) => {
    const updated = await apiRequest<SchoolDatabase>('/api/classes', 'POST', payload);
    setDb(updated);
    setModal({ type: 'none' });
    showToast(`Created class "${payload.name}" in UGX fee schedule.`);
  };

  const handleAdmitStudent = async (payload: AdmissionPayload) => {
    const res = await apiRequest<{ student: Student; db: SchoolDatabase }>('/api/students', 'POST', payload);
    setDb(res.db);
    setModal({ type: 'none' });
    showToast(`Admitted ${res.student.fullName} (Assigned ID: ${res.student.admissionNo}).`);
  };

  const handleRecordPayment = async (payload: {
    studentId: string;
    amount: number;
    method: PaymentMethod;
    paymentDate: string;
    term?: string;
    recordedBy: string;
    notes: string;
  }) => {
    const res = await apiRequest<{ payment: FeePayment; db: SchoolDatabase }>('/api/payments', 'POST', payload);
    setDb(res.db);
    const updatedSummaries = computeStudentFeeSummaries(res.db);
    const summary = updatedSummaries.find((s) => s.student.id === payload.studentId);
    if (summary) {
      setModal({ type: 'receipt', payment: res.payment, summary });
    } else {
      setModal({ type: 'none' });
    }
    showToast(`Recorded fee payment (${res.payment.receiptNo}).`);
  };

  const handleRecordExpense = async (payload: {
    category: ExpenseCategory;
    description: string;
    vendor: string;
    amount: number;
    paymentMethod: PaymentMethod | 'Bank Transfer';
    requestedBy: string;
    date: string;
    notes: string;
  }) => {
    const res = await apiRequest<{ expense: { voucherNo: string; approvalStatus: string }; db: SchoolDatabase }>(
      '/api/expenses',
      'POST',
      payload
    );
    setDb(res.db);
    setModal({ type: 'none' });
    showToast(
      res.expense.approvalStatus === 'Pending Owner Approval'
        ? `Expense ${res.expense.voucherNo} queued for Owner approval.`
        : `Expense ${res.expense.voucherNo} recorded and posted.`
    );
  };

  const handleApproveExpense = async (expenseId: string, status: 'Approved' | 'Rejected') => {
    const updated = await apiRequest<SchoolDatabase>(`/api/expenses/${expenseId}`, 'PATCH', {
      approvalStatus: status,
    });
    setDb(updated);
    showToast(`Requisition marked as ${status}.`);
  };

  const handlePayPayroll = async (payload: { month: string; staffId?: string; category?: StaffCategory }) => {
    const res = await apiRequest<{ updatedCount: number; db: SchoolDatabase }>('/api/payroll/pay', 'POST', payload);
    setDb(res.db);
    showToast(`Disbursed UGX salaries for ${res.updatedCount} staff member(s).`);
  };

  const handleAddStaff = async (payload: {
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
  }) => {
    const res = await apiRequest<{ staffMember: StaffMember; db: SchoolDatabase }>('/api/staff', 'POST', payload);
    setDb(res.db);
    setModal({ type: 'none' });
    showToast(`Added ${res.staffMember.fullName} (${res.staffMember.category}) to payroll.`);
  };

  const handleUpdateStaff = async (
    staffId: string,
    patch: { status?: 'Active' | 'On Leave'; performanceNote?: string; baseSalary?: number }
  ) => {
    const updated = await apiRequest<SchoolDatabase>(`/api/staff/${staffId}`, 'PATCH', patch);
    setDb(updated);
    showToast('Staff record updated.');
  };

  const handleUpdateStudent = async (
    studentId: string,
    patch: {
      enrollmentStatus?: EnrollmentStatus;
      attendanceRate?: number;
      academicAverage?: number;
      classId?: string;
      notes?: string;
    }
  ) => {
    const updated = await apiRequest<SchoolDatabase>(`/api/students/${studentId}`, 'PATCH', patch);
    setDb(updated);
    showToast('Student record updated.');
  };

  const handleUpdateClass = async (
    classId: string,
    patch: Partial<Pick<SchoolClass, 'tuitionFee' | 'lunchFee' | 'activityFee' | 'capacity' | 'classTeacherId'>>
  ) => {
    const updated = await apiRequest<SchoolDatabase>(`/api/classes/${classId}`, 'PATCH', patch);
    setDb(updated);
    showToast('Class fee structure updated.');
  };

  const handlePostNotice = async (notice: {
    title: string;
    audience: 'All Staff' | 'Teaching Staff' | 'Parents & Guardians' | 'Leadership';
    body: string;
    priority: 'Standard' | 'Urgent';
  }) => {
    const res = await apiRequest<{ db: SchoolDatabase }>('/api/notices', 'POST', {
      ...notice,
      author: ROLE_PROFILES[role].roleLabel,
    });
    setDb(res.db);
    showToast('Campus notice published.');
  };

  const handleUpdateProfile = async (profile: Partial<SchoolProfile>) => {
    const updated = await apiRequest<SchoolDatabase>('/api/school/profile', 'PATCH', profile);
    setDb(updated);
    showToast('School settings saved.');
  };

  const handleRestoreBackup = async (backup: SchoolDatabase) => {
    const updated = await apiRequest<SchoolDatabase>('/api/school/restore', 'POST', backup);
    setDb(updated);
    showToast('School database restored from backup.');
  };

  const handleClearAllData = async () => {
    const updated = await apiRequest<SchoolDatabase>('/api/school/clear', 'POST');
    setDb(updated);
    showToast('All school records cleared.');
  };

  const handleCreateUser = async (payload: {
    fullName: string;
    username: string;
    role: DashboardRole;
    password: string;
  }) => {
    const res = await apiRequest<{ user: AuthUser; users: AuthUser[] }>('/api/users', 'POST', payload);
    setUsersList(res.users);
    showToast(`Created login for ${res.user.fullName} (${ROLE_PROFILES[res.user.role].roleLabel}).`);
  };

  const handleUpdateUser = async (
    userId: string,
    patch: { isActive?: boolean; password?: string; role?: DashboardRole }
  ) => {
    const res = await apiRequest<{ user: AuthUser; users: AuthUser[] }>(`/api/users/${userId}`, 'PATCH', patch);
    setUsersList(res.users);
    showToast(`Updated account for ${res.user.fullName}.`);
  };

  const handleChangeOwnPassword = async (currentPassword: string, newPassword: string) => {
    await apiRequest<{ ok: boolean }>('/api/auth/password', 'POST', { currentPassword, newPassword });
    setModal({ type: 'none' });
    showToast('Your password has been updated.');
  };

  const navConfig: Record<
    DashboardRole,
    Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }>
  > = {
    registrar: [
      { id: 'admissions', label: 'Student Admissions', icon: ClipboardList },
      { id: 'classes', label: 'Classes & UGX Fees', icon: BookOpen },
      { id: 'attendance', label: 'Attendance & Marks', icon: CalendarCheck },
    ],
    bursar: [
      { id: 'overview', label: 'Bursar Overview', icon: LayoutDashboard },
      { id: 'fees', label: 'Fees & Class Matrix', icon: CreditCard },
      { id: 'defaulters', label: 'Fee Defaulters', icon: AlertTriangle },
      { id: 'payroll', label: 'Staff Payroll', icon: Wallet },
      { id: 'ledger', label: 'Expenses & Cashbook', icon: Banknote },
    ],
    headteacher: [
      { id: 'overview', label: 'Campus Overview', icon: LayoutDashboard },
      { id: 'students', label: 'Class & Student Standing', icon: GraduationCap },
      { id: 'staff', label: 'Teaching & Support Staff', icon: Users },
      { id: 'notices', label: 'Campus Notices', icon: Megaphone },
    ],
    owner: [
      { id: 'overview', label: 'Executive Summary', icon: LayoutDashboard },
      { id: 'approvals', label: 'Approvals Queue', icon: CheckSquare },
      { id: 'pnl', label: 'Termly P&L Statement', icon: FileSpreadsheet },
      { id: 'users', label: 'User Logins', icon: KeyRound },
      { id: 'settings', label: 'Settings & Backup', icon: Settings },
    ],
  };

  const activeNavId =
    role === 'owner'
      ? ownerView
      : role === 'headteacher'
      ? headView
      : role === 'bursar'
      ? bursarView
      : registrarView;

  const setActiveNavId = (id: string) => {
    if (role === 'owner') setOwnerView(id as OwnerView);
    if (role === 'headteacher') setHeadView(id as HeadTeacherView);
    if (role === 'bursar') setBursarView(id as BursarView);
    if (role === 'registrar') setRegistrarView(id as RegistrarView);
    setMobileMenuOpen(false);
  };

  const activeNavLabel = navConfig[role].find((item) => item.id === activeNavId)?.label || 'Overview';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
        <div className="w-full max-w-4xl space-y-4">
          <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center space-y-4">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <h1 className="text-lg font-semibold text-slate-900">Unable to load school database</h1>
          <p className="text-sm text-slate-500">{loadError || 'Database could not be initialized.'}</p>
          <button
            type="button"
            onClick={() => (authToken ? fetchSchoolData() : fetchAuthStatus())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!authToken || !currentUser) {
    if (!authStatus) return null;
    return <AuthGate status={authStatus} onAuthenticated={handleAuthenticated} />;
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md text-center space-y-4">
          <Building2 className="w-8 h-8 text-slate-400 mx-auto" />
          <h1 className="text-lg font-semibold text-slate-900">Loading School Workspace</h1>
          <button
            type="button"
            onClick={() => fetchSchoolData()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
          >
            Reload Data
          </button>
        </div>
      </div>
    );
  }

  const allowedRoles = ALLOWED_ROLES_BY_USER[currentUser.role];
  const studentSummaries = computeStudentFeeSummaries(db);
  const overviewMetrics = computeFinancialOverview(db);
  const pendingApprovalsCount = overviewMetrics.pendingApprovalExpenses.length;
  const defaultersCount = overviewMetrics.defaulterStudents.length;
  const highRiskDefaulters = overviewMetrics.highRiskDefaulters;
  const unackedHighRisk = highRiskDefaulters.filter((r) => !acknowledgedRiskIds.includes(r.student.id));
  const openHighRiskDefaultersList = () => {
    setRole('bursar');
    setBursarView('defaulters');
    setDefaulterScopeRequest({ scope: 'high_risk', seq: Date.now() });
    setAlertsOpen(false);
  };
  const activeRoleProfile = ROLE_PROFILES[role];
  const nextStudentIdHint = `STU-${new Date().getFullYear()}-${String(db.students.length + 1).padStart(4, '0')}`;
  const isFreshSetup = db.classes.length === 0 || db.students.length === 0 || db.staff.length === 0;
  const setupStepsDone = [db.classes.length > 0, db.students.length > 0, db.staff.length > 0].filter(Boolean).length;
  const setupTotalSteps = currentUser.role === 'owner' ? 4 : 3;
  const setupCompletedCount =
    currentUser.role === 'owner' ? setupStepsDone + (usersList.length > 1 ? 1 : 0) : setupStepsDone;
  const setupProgressPct = Math.round((setupCompletedCount / setupTotalSteps) * 100);

  const SidebarContent = (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0F1E4A] via-[#162D6B] to-[#1D3E8F] text-slate-100">
      {/* Brand Zone */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
        <SchoolCrest size="md" />
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{db.profile.schoolName}</div>
          <div className="text-xs text-sky-200 truncate">{db.profile.activeTerm} · UGX</div>
        </div>
      </div>

      {/* Role Dashboards Switcher (Scoped to signed-in user's permissions) */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="text-xs font-medium text-sky-200 px-1 mb-2">
          {allowedRoles.length > 1 ? 'Switch Dashboard' : 'Your Dashboard'}
        </div>
        <div className="space-y-1.5">
          {allowedRoles.map((r) => {
            const prof = ROLE_PROFILES[r];
            const isActive = role === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-blue-600/95 ring-1 ring-white/25 text-white shadow-sm'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <RoleAvatar role={r} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{prof.roleLabel}</div>
                  <div className={`text-[11px] truncate ${isActive ? 'text-sky-100' : 'text-slate-300/80'}`}>
                    {prof.officeTitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role-Specific Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Dashboard sections">
        <div className="text-xs font-medium text-blue-200 px-2 mb-2">{activeRoleProfile.shortTitle} Menu</div>
        {navConfig[role].map((item) => {
          const Icon = item.icon;
          const isCurrent = activeNavId === item.id;
          const inlineCount =
            role === 'owner' && item.id === 'approvals' && pendingApprovalsCount > 0
              ? pendingApprovalsCount
              : role === 'bursar' && item.id === 'defaulters' && defaultersCount > 0
              ? defaultersCount
              : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNavId(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                isCurrent ? 'bg-white text-[#132257] font-semibold shadow-sm' : 'text-slate-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-blue-700' : 'text-blue-300'}`} />
              <span className="truncate flex-1 text-left">{item.label}</span>
              {inlineCount > 0 && (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    isCurrent ? 'text-blue-700 font-semibold' : 'text-amber-300 font-medium'
                  }`}
                >
                  {inlineCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Signed-in Account Footer */}
      <div className="p-4 border-t border-white/10 text-xs text-indigo-200 space-y-2.5">
        <div>
          <div className="font-semibold text-white truncate">{currentUser.fullName}</div>
          <div className="text-[11px] text-indigo-300 truncate">
            @{currentUser.username} · {ROLE_PROFILES[currentUser.role].shortTitle}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModal({ type: 'change_password' })}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors"
          >
            <KeyRound className="w-3 h-3" />
            Password
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white text-[11px] font-medium transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  const quickActions: QuickActionItem[] = [
    ...(allowedRoles.includes('registrar')
      ? [
          {
            id: 'qa-admit',
            title: 'Register a New Student',
            subtitle: 'Step-by-step admission with unique ID',
            keywords: 'admit student register learner enroll',
            icon: QFUserPlus,
            toneClass: 'bg-blue-50 text-blue-700',
            onSelect: () => {
              setRole('registrar');
              setRegistrarView('admissions');
              setModal({ type: 'admit_student' });
            },
          },
          {
            id: 'qa-class',
            title: 'Add a School Class',
            subtitle: 'Set class name and UGX term fees',
            keywords: 'class fee tuition stream',
            icon: QFBookOpen,
            toneClass: 'bg-teal-50 text-teal-700',
            onSelect: () => {
              setRole('registrar');
              setRegistrarView('classes');
              setModal({ type: 'add_class' });
            },
          },
        ]
      : []),
    ...(allowedRoles.includes('bursar')
      ? [
          {
            id: 'qa-collect',
            title: 'Collect School Fees',
            subtitle: 'Record fee payment & print receipt',
            keywords: 'pay fees collect receipt money student',
            icon: QFCreditCard,
            toneClass: 'bg-emerald-50 text-emerald-700',
            onSelect: () => {
              setRole('bursar');
              setModal({ type: 'record_payment' });
            },
          },
          {
            id: 'qa-scan-receipt',
            title: 'Scan & Verify Fee Receipt QR',
            subtitle: 'Use camera or receipt number to verify payment in ledger',
            keywords: 'qr scan verify receipt camera check authentic payment ledger',
            icon: QFCreditCard,
            toneClass: 'bg-blue-50 text-blue-700',
            onSelect: () => {
              setRole('bursar');
              setModal({ type: 'scan_receipt' });
            },
          },
          {
            id: 'qa-defaulters',
            title: 'See Who Still Owes Fees',
            subtitle: `${defaultersCount} critical defaulters tracked`,
            keywords: 'defaulters arrears balance owe unpaid',
            icon: QFAlertTriangle,
            toneClass: 'bg-rose-50 text-rose-700',
            onSelect: () => {
              setRole('bursar');
              setBursarView('defaulters');
            },
          },
          {
            id: 'qa-high-risk-defaulters',
            title: 'High-Risk Multi-Term Defaulters',
            subtitle: `${highRiskDefaulters.length} students flagged for recurring payment delays`,
            keywords: 'high risk defaulter recurring multi term alerts arrears notification',
            icon: QFAlertTriangle,
            toneClass: 'bg-rose-100 text-rose-800',
            onSelect: openHighRiskDefaultersList,
          },
          {
            id: 'qa-payroll',
            title: 'Pay Staff Salaries',
            subtitle: 'Teachers & support staff UGX payroll',
            keywords: 'salary payroll pay teachers non-teaching staff',
            icon: QFWallet,
            toneClass: 'bg-indigo-50 text-indigo-700',
            onSelect: () => {
              setRole('bursar');
              setBursarView('payroll');
            },
          },
          {
            id: 'qa-expense',
            title: 'Record a School Expense',
            subtitle: 'Log food, bills, repairs, or supplies',
            keywords: 'expense spend cashbook voucher food bills',
            icon: QFBanknote,
            toneClass: 'bg-amber-50 text-amber-700',
            onSelect: () => {
              setRole('bursar');
              setModal({ type: 'record_expense' });
            },
          },
        ]
      : []),
    ...(allowedRoles.includes('owner')
      ? [
          {
            id: 'qa-approvals',
            title: 'Review Expense Approvals',
            subtitle: `${pendingApprovalsCount} waiting for Owner sign-off`,
            keywords: 'approve reject pending owner',
            icon: QFCheckSquare,
            toneClass: 'bg-amber-50 text-amber-700',
            onSelect: () => {
              setRole('owner');
              setOwnerView('approvals');
            },
          },
          {
            id: 'qa-pnl',
            title: 'View Profit & Loss (UGX)',
            subtitle: 'Total fees collected vs. money spent',
            keywords: 'pnl profit loss income expenditure statement',
            icon: QFFileSpreadsheet,
            toneClass: 'bg-emerald-50 text-emerald-700',
            onSelect: () => {
              setRole('owner');
              setOwnerView('pnl');
            },
          },
          {
            id: 'qa-users',
            title: 'Create Staff User Logins',
            subtitle: 'Add Head Teacher, Bursar, or Registrar login',
            keywords: 'users login password account staff',
            icon: QFKeyRound,
            toneClass: 'bg-blue-50 text-blue-700',
            onSelect: () => {
              setRole('owner');
              setOwnerView('users');
            },
          },
          {
            id: 'qa-settings',
            title: 'School Settings & Backup',
            subtitle: 'Change school name, term, or save backup',
            keywords: 'settings school name backup restore',
            icon: QFSettings,
            toneClass: 'bg-slate-100 text-slate-700',
            onSelect: () => {
              setRole('owner');
              setOwnerView('settings');
            },
          },
        ]
      : []),
    ...(allowedRoles.includes('owner') || allowedRoles.includes('bursar')
      ? [
          {
            id: 'qa-csv-exports',
            title: 'Export CSV Financial & Fee Reports',
            subtitle: 'Student fees, receipts, defaulters, P&L, cashbook & payroll',
            keywords: 'export csv excel download financial report student fees receipts cashbook',
            icon: QFFileSpreadsheet,
            toneClass: 'bg-teal-50 text-teal-700',
            onSelect: () => setModal({ type: 'csv_exports' }),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen no-print">{SidebarContent}</aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-white/80 hover:bg-white/10 z-20"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/90 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span className="font-semibold text-slate-900">{db.profile.schoolName}</span>
              <span className="mx-2 text-slate-300">/</span>
              <span>{activeRoleProfile.roleLabel}</span>
              <span className="mx-2 text-slate-300 hidden sm:inline">/</span>
              <span className="hidden sm:inline text-blue-700 font-semibold">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setQuickFinderOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100/90 hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200 border border-slate-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
              title="Search for any student, staff member, or task"
            >
              <Search className="w-3.5 h-3.5 text-blue-700" />
              <span className="hidden sm:inline">Search Student or Task</span>
            </button>

            {(role === 'owner' || role === 'bursar') && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsOpen((prev) => !prev)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap shrink-0 ${
                    highRiskDefaulters.length > 0
                      ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                  title="Automated High-Risk Defaulter Notifications"
                >
                  <Bell className={`w-3.5 h-3.5 ${highRiskDefaulters.length > 0 ? 'text-rose-700' : 'text-slate-500'}`} />
                  <span className="hidden sm:inline">Risk Alerts</span>
                  {unackedHighRisk.length > 0 ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono tabular-nums bg-rose-700 text-white rounded-md">
                      {unackedHighRisk.length}
                    </span>
                  ) : highRiskDefaulters.length > 0 ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold font-mono tabular-nums bg-rose-200 text-rose-900 rounded-md">
                      {highRiskDefaulters.length}
                    </span>
                  ) : null}
                </button>

                {alertsOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setAlertsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-[330px] sm:w-[400px] bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200 bg-rose-50/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              Automated High-Risk Defaulter Alerts
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              Flags recurring payment delays across multiple terms
                            </div>
                          </div>
                        </div>
                        {unackedHighRisk.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setAcknowledgedRiskIds(highRiskDefaulters.map((r) => r.student.id))}
                            className="text-[11px] font-semibold text-rose-700 hover:underline shrink-0"
                          >
                            Mark all seen
                          </button>
                        )}
                      </div>

                      {highRiskDefaulters.length === 0 ? (
                        <div className="p-6 text-center space-y-1.5">
                          <div className="text-xs font-semibold text-slate-800">No High-Risk Flags Active</div>
                          <div className="text-[11px] text-slate-500">
                            Students with recurring payment delays across 2 or more terms will automatically appear here.
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                          {highRiskDefaulters.slice(0, 8).map((item) => (
                            <div key={item.student.id} className="p-3.5 hover:bg-slate-50 transition-colors space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {item.student.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {item.student.admissionNo} · {item.schoolClass?.name || 'Unassigned'} ·{' '}
                                    <span className="font-semibold text-rose-700">
                                      {item.riskProfile.delayedTermsCount} delayed term(s)
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-xs font-bold font-mono tabular-nums text-rose-700">
                                    {formatUGX(item.riskProfile.cumulativeArrears)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Risk {item.riskProfile.riskScore}/100
                                  </div>
                                </div>
                              </div>
                              {item.riskProfile.flagReasons[0] && (
                                <div className="text-[11px] text-slate-600 bg-rose-50/60 border border-rose-100 rounded-lg px-2 py-1">
                                  {item.riskProfile.flagReasons[0]}
                                </div>
                              )}
                              <div className="flex items-center justify-end gap-2 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAlertsOpen(false);
                                    setRole('bursar');
                                    setModal({ type: 'record_payment', studentId: item.student.id });
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
                                >
                                  Collect Fee
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {highRiskDefaulters.length} total flagged
                        </span>
                        <button
                          type="button"
                          onClick={openHighRiskDefaultersList}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 rounded-lg hover:bg-rose-800"
                        >
                          Open High-Risk List
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {(role === 'owner' || role === 'bursar') && (
              <button
                type="button"
                onClick={() => setModal({ type: 'csv_exports' })}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors whitespace-nowrap shrink-0"
                title="Export financial reports & student fee records as CSV"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}

            {role === 'registrar' && (
              <button
                type="button"
                onClick={() => setModal({ type: 'admit_student' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 shadow-sm whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Register Student
              </button>
            )}
            {role === 'bursar' && (
              <>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'scan_receipt' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                  title="Scan fee receipt QR code with camera"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'record_payment' })}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Collect Fee
                </button>
              </>
            )}
            {role === 'headteacher' && (
              <button
                type="button"
                onClick={() => setModal({ type: 'record_expense' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 shadow-sm whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Request Expense
              </button>
            )}
            {role === 'owner' && (
              <button
                type="button"
                onClick={() => setOwnerView('approvals')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 shadow-sm whitespace-nowrap shrink-0"
              >
                Approvals ({pendingApprovalsCount})
              </button>
            )}
          </div>
        </header>

        {/* Guided School Setup Strip (only shown while school setup is incomplete) */}
        {isFreshSetup && (
          <div className="px-4 sm:px-6 pt-4 no-print">
            <div className="bg-gradient-to-r from-white via-blue-50/50 to-emerald-50/50 border border-blue-200/90 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">Easy Start Guide — Set Up Your School</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Click these simple buttons in order from left to right to get your school ready in minutes.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono tabular-nums text-blue-800 font-semibold">
                    {setupCompletedCount} of {setupTotalSteps} steps done
                  </div>
                  <div className="w-28 h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${setupProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(currentUser.role === 'owner' || currentUser.role === 'registrar' || currentUser.role === 'headteacher') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'add_class' })}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        db.classes.length > 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-blue-700 border-blue-700 text-white hover:bg-blue-800 shadow-sm'
                      }`}
                    >
                      {db.classes.length > 0 && <Check className="w-3.5 h-3.5" />}
                      1. Add Classes ({db.classes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ type: 'admit_student' })}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                        db.students.length > 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {db.students.length > 0 && <Check className="w-3.5 h-3.5" />}
                      2. Register Students ({db.students.length})
                    </button>
                  </>
                )}
                {(currentUser.role === 'owner' || currentUser.role === 'bursar' || currentUser.role === 'headteacher') && (
                  <button
                    type="button"
                    onClick={() => setModal({ type: 'add_staff' })}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      db.staff.length > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {db.staff.length > 0 && <Check className="w-3.5 h-3.5" />}
                    3. Add Teachers &amp; Staff ({db.staff.length})
                  </button>
                )}
                {currentUser.role === 'owner' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRole('owner');
                      setOwnerView('users');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-colors ${
                      usersList.length > 1
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-white border-blue-300 text-blue-800 hover:bg-blue-50'
                    }`}
                  >
                    {usersList.length > 1 && <Check className="w-3.5 h-3.5" />}
                    4. Create Staff Logins ({usersList.length})
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Toast notification */}
        {toast && (
          <div className="px-4 sm:px-6 pt-4 no-print">
            <div
              role="status"
              className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between ${
                toast.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <span>{toast.message}</span>
              <button type="button" onClick={() => setToast(null)} className="ml-4 hover:underline">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Active Dashboard Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1360px] w-full mx-auto">
          {role === 'owner' && (
            <OwnerDashboard
              db={db}
              activeView={ownerView}
              currentUserId={currentUser.id}
              users={usersList}
              onNavigate={setOwnerView}
              onOpenExportModal={() => setModal({ type: 'csv_exports' })}
              onApproveExpense={handleApproveExpense}
              onUpdateProfile={handleUpdateProfile}
              onRestoreBackup={handleRestoreBackup}
              onClearAllData={handleClearAllData}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
            />
          )}

          {role === 'headteacher' && (
            <HeadTeacherDashboard
              db={db}
              activeView={headView}
              onNavigate={setHeadView}
              onUpdateStudent={handleUpdateStudent}
              onUpdateStaff={handleUpdateStaff}
              onPostNotice={handlePostNotice}
              onOpenExpenseModal={() => setModal({ type: 'record_expense' })}
            />
          )}

          {role === 'bursar' && (
            <BursarDashboard
              db={db}
              activeView={bursarView}
              defaulterScopeRequest={defaulterScopeRequest}
              onNavigate={setBursarView}
              onOpenExportModal={() => setModal({ type: 'csv_exports' })}
              onOpenScannerModal={() => setModal({ type: 'scan_receipt' })}
              onOpenPaymentModal={(studentId) => setModal({ type: 'record_payment', studentId })}
              onOpenReceiptModal={(payment, summary) => setModal({ type: 'receipt', payment, summary })}
              onOpenPayslipModal={(staff, payroll) => setModal({ type: 'payslip', staff, payroll })}
              onOpenExpenseModal={() => setModal({ type: 'record_expense' })}
              onOpenAddStaffModal={() => setModal({ type: 'add_staff' })}
              onPayPayroll={handlePayPayroll}
              onUpdateStaffSalary={(staffId, baseSalary) => handleUpdateStaff(staffId, { baseSalary })}
            />
          )}

          {role === 'registrar' && (
            <RegistrarDashboard
              db={db}
              activeView={registrarView}
              onNavigate={setRegistrarView}
              onOpenEnrollModal={() => setModal({ type: 'admit_student' })}
              onOpenAddClassModal={() => setModal({ type: 'add_class' })}
              onOpenStudentDossier={(student) => setModal({ type: 'student_dossier', student })}
              onUpdateClass={handleUpdateClass}
              onUpdateStudent={handleUpdateStudent}
            />
          )}
        </main>
      </div>

      {/* Quick Finder Command Bar */}
      {quickFinderOpen && (
        <QuickFinderModal
          db={db}
          userRole={currentUser.role}
          actions={quickActions}
          onSelectStudent={(student) => setModal({ type: 'student_dossier', student })}
          onGoToStaff={() => {
            if (allowedRoles.includes('bursar')) {
              setRole('bursar');
              setBursarView('payroll');
            } else if (allowedRoles.includes('headteacher')) {
              setRole('headteacher');
              setHeadView('staff');
            }
          }}
          onClose={() => setQuickFinderOpen(false)}
        />
      )}

      {/* Modals */}
      {modal.type === 'add_class' && (
        <AddClassModal
          staff={db.staff}
          onSubmit={handleAddClass}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'admit_student' && (
        <StudentAdmissionModal
          classes={db.classes}
          nextStudentIdHint={nextStudentIdHint}
          onSubmit={handleAdmitStudent}
          onOpenAddClass={() => setModal({ type: 'add_class' })}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'student_dossier' && (
        <StudentDossierModal
          profile={db.profile}
          student={modal.student}
          schoolClass={db.classes.find((c) => c.id === modal.student.classId) || null}
          summary={studentSummaries.find((s) => s.student.id === modal.student.id)}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'record_payment' && (
        <RecordPaymentModal
          studentSummaries={studentSummaries}
          activeTerm={db.profile.activeTerm}
          initialStudentId={modal.studentId}
          recordedBy={ROLE_PROFILES[role].roleLabel}
          onSubmit={handleRecordPayment}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'receipt' && (
        <ReceiptModal
          profile={db.profile}
          payment={modal.payment}
          summary={modal.summary}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'scan_receipt' && authToken && (
        <ReceiptScannerModal
          db={db}
          authToken={authToken}
          initialQrInput={modal.initialQrInput}
          onCollectFee={(studentId) => setModal({ type: 'record_payment', studentId })}
          onOpenReceipt={(payment, summary) => setModal({ type: 'receipt', payment, summary })}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'payslip' && (
        <PayslipModal
          profile={db.profile}
          staff={modal.staff}
          payroll={modal.payroll}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'record_expense' && (
        <RecordExpenseModal
          approvalThresholdUgx={db.profile.approvalThresholdUgx}
          defaultRequestedBy={ROLE_PROFILES[role].roleLabel}
          onSubmit={handleRecordExpense}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'add_staff' && (
        <AddStaffModal
          onSubmit={handleAddStaff}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'csv_exports' && (
        <CsvExportModal
          db={db}
          onClose={() => setModal({ type: 'none' })}
          onExported={(message) => showToast(message)}
        />
      )}

      {modal.type === 'change_password' && (
        <ChangePasswordModal
          onSubmit={handleChangeOwnPassword}
          onClose={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  );
}

function ChangePasswordModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 no-print">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Change Your Password</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">New Password (min 6 chars) *</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-700 font-medium">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
