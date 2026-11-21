export type DashboardRole = 'bursar' | 'headteacher' | 'owner' | 'registrar';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: DashboardRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthStatusResponse {
  requiresInitialSetup: boolean;
  schoolName: string;
}

export interface SchoolProfile {
  schoolName: string;
  motto: string;
  address: string;
  phone: string;
  email: string;
  activeTerm: string;
  activeMonth: string;
  feeDeadlineDate: string;
  approvalThresholdUgx: number;
}

export interface SchoolClass {
  id: string;
  name: string;
  stream: string;
  room: string;
  capacity: number;
  classTeacherId: string;
  tuitionFee: number;
  lunchFee: number;
  activityFee: number;
}

export type EnrollmentStatus = 'Active' | 'Transferred' | 'Suspended';
export type BoardingStatus = 'Day Scholar' | 'Boarding';

export interface Student {
  id: string;
  admissionNo: string; // Unique Student ID e.g. STU-2026-0001
  fullName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  nationality: string;
  homeAddress: string;
  classId: string;
  boardingStatus: BoardingStatus;
  enrollmentStatus: EnrollmentStatus;
  admissionDate: string;
  // Guardian details
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Previous academic performance
  previousSchool: string;
  previousClass: string;
  previousAcademicScore: string;
  academicPerformanceNotes: string;
  // Special needs & medical
  hasSpecialNeeds: boolean;
  specialNeedsDetails: string;
  // Ongoing term metrics & finance
  attendanceRate: number;
  academicAverage: number;
  feeDiscount: number;
  notes: string;
}

export type PaymentMethod = 'Cash' | 'Bank Deposit' | 'Mobile Money' | 'Cheque';

export interface FeePayment {
  id: string;
  receiptNo: string;
  studentId: string;
  term: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  recordedBy: string;
  notes: string;
}

export type StaffCategory = 'Teaching' | 'Non-Teaching';

export interface StaffMember {
  id: string;
  employeeNo: string;
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
  attendanceRate: number;
  status: 'Active' | 'On Leave';
  hireDate: string;
  performanceNote: string;
}

export interface PayrollRecord {
  id: string;
  voucherNo: string;
  staffId: string;
  month: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: 'Paid' | 'Pending';
  paidDate: string | null;
  paymentMethod: PaymentMethod | 'Bank Transfer';
}

export type ExpenseCategory =
  | 'Utilities'
  | 'Food & Kitchen'
  | 'Teaching Supplies'
  | 'Maintenance'
  | 'Transport & Fuel'
  | 'Administration'
  | 'Capital & Equipment';

export type ExpenseApprovalStatus = 'Approved' | 'Pending Owner Approval' | 'Rejected';

export interface SchoolExpense {
  id: string;
  voucherNo: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  paymentMethod: PaymentMethod | 'Bank Transfer';
  requestedBy: string;
  approvalStatus: ExpenseApprovalStatus;
  paidStatus: 'Paid' | 'Unpaid';
  notes: string;
}

export interface CampusNotice {
  id: string;
  title: string;
  audience: 'All Staff' | 'Teaching Staff' | 'Parents & Guardians' | 'Leadership';
  date: string;
  author: string;
  body: string;
  priority: 'Standard' | 'Urgent';
}

export interface SchoolDatabase {
  profile: SchoolProfile;
  classes: SchoolClass[];
  students: Student[];
  feePayments: FeePayment[];
  staff: StaffMember[];
  payroll: PayrollRecord[];
  expenses: SchoolExpense[];
  notices: CampusNotice[];
  lastUpdated: string;
}

export type FeeClearanceStatus = 'Paid in Full' | 'Partial' | 'Defaulter';

export interface TermFeeBreakdown {
  term: string;
  billed: number;
  paid: number;
  balance: number;
  percentPaid: number;
  latePaymentsCount: number;
  lastPaymentDate: string | null;
  delayed: boolean;
  reason: string;
}

export type DefaulterRiskLevel = 'Standard' | 'Watchlist' | 'High-Risk';

export interface MultiTermRiskProfile {
  termsEvaluatedCount: number;
  delayedTermsCount: number;
  unpaidTermsCount: number;
  latePaymentCount: number;
  priorTermsArrears: number;
  cumulativeArrears: number;
  riskScore: number;
  riskLevel: DefaulterRiskLevel;
  flagReasons: string[];
  termBreakdowns: TermFeeBreakdown[];
}

export interface StudentFeeSummary {
  student: Student;
  schoolClass: SchoolClass | null;
  grossFee: number;
  discount: number;
  netBilled: number;
  totalPaid: number;
  balance: number;
  percentPaid: number;
  feeStatus: FeeClearanceStatus;
  lastPaymentDate: string | null;
  payments: FeePayment[];
  allPayments: FeePayment[];
  riskProfile: MultiTermRiskProfile;
}

export interface ClassFeeSummary {
  schoolClass: SchoolClass;
  studentCount: number;
  feePerStudent: number;
  expectedTotal: number;
  collectedTotal: number;
  outstandingTotal: number;
  paidCount: number;
  partialCount: number;
  defaulterCount: number;
  collectionRate: number;
}

export interface ReceiptVerificationResult {
  verified: boolean;
  integrityMatch: boolean;
  mismatchReason?: string;
  message?: string;
  payment?: FeePayment;
  student?: Student;
  className?: string;
  activeTerm?: string;
  termSummary?: {
    netBilled: number;
    totalPaid: number;
    balance: number;
    percentPaid: number;
    feeStatus: FeeClearanceStatus;
  };
  studentPayments?: FeePayment[];
}

