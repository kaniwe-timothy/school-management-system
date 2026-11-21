import type {
  ClassFeeSummary,
  DefaulterRiskLevel,
  FeeClearanceStatus,
  FeePayment,
  MultiTermRiskProfile,
  SchoolClass,
  SchoolDatabase,
  SchoolProfile,
  StudentFeeSummary,
  TermFeeBreakdown,
} from '../shared/types';

export function formatUGX(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  return `UGX ${rounded.toLocaleString('en-US')}`;
}

export function getClassTotalFee(cls: SchoolClass): number {
  return cls.tuitionFee + cls.lunchFee + cls.activityFee;
}

interface ParsedTerm {
  year: number;
  termNum: 1 | 2 | 3;
  label: string;
  orderKey: number;
}

export function parseTermLabel(termLabel: string, fallbackYear = new Date().getFullYear()): ParsedTerm {
  const match = termLabel.match(/Term\s*([1-3])[\s,/-]*(\d{4})?/i);
  if (match) {
    const termNum = Number(match[1]) as 1 | 2 | 3;
    const year = match[2] ? Number(match[2]) : fallbackYear;
    return {
      year,
      termNum,
      label: `Term ${termNum}, ${year}`,
      orderKey: year * 3 + (termNum - 1),
    };
  }
  return {
    year: fallbackYear,
    termNum: 1,
    label: termLabel || `Term 1, ${fallbackYear}`,
    orderKey: fallbackYear * 3,
  };
}

function getTermFromDate(isoDate: string): ParsedTerm {
  const parsedYear = Number(isoDate.slice(0, 4));
  const parsedMonth = Number(isoDate.slice(5, 7));
  const year = Number.isFinite(parsedYear) && parsedYear >= 2000 ? parsedYear : new Date().getFullYear();
  let termNum: 1 | 2 | 3 = 1;
  if (Number.isFinite(parsedMonth)) {
    if (parsedMonth >= 9) termNum = 3;
    else if (parsedMonth >= 5) termNum = 2;
  }
  return {
    year,
    termNum,
    label: `Term ${termNum}, ${year}`,
    orderKey: year * 3 + (termNum - 1),
  };
}

function getEstimatedTermDeadline(parsed: ParsedTerm, activeParsed: ParsedTerm, activeDeadline: string): string {
  if (parsed.orderKey === activeParsed.orderKey && activeDeadline) {
    return activeDeadline;
  }
  if (parsed.termNum === 1) return `${parsed.year}-03-15`;
  if (parsed.termNum === 2) return `${parsed.year}-07-01`;
  return `${parsed.year}-11-01`;
}

export function getAvailablePaymentTerms(activeTerm: string): string[] {
  const active = parseTermLabel(activeTerm);
  const terms: string[] = [];
  for (let offset = 3; offset >= 0; offset -= 1) {
    const key = active.orderKey - offset;
    const year = Math.floor(key / 3);
    const termNum = ((key % 3) + 1) as 1 | 2 | 3;
    const label = offset === 0 ? activeTerm : `Term ${termNum}, ${year}`;
    if (!terms.includes(label)) {
      terms.push(label);
    }
  }
  return terms;
}

function buildMultiTermRiskProfile(
  admissionDate: string,
  netBilled: number,
  allStudentPayments: FeePayment[],
  profile: SchoolProfile,
  todayIso: string
): MultiTermRiskProfile {
  const activeParsed = parseTermLabel(profile.activeTerm);
  const admissionParsed = getTermFromDate(admissionDate || todayIso);

  let earliestOrder = Math.min(activeParsed.orderKey, admissionParsed.orderKey);
  const extraNonStandardTerms = new Set<string>();

  allStudentPayments.forEach((p) => {
    const match = p.term.match(/Term\s*[1-3]/i);
    if (match) {
      const pTerm = parseTermLabel(p.term, activeParsed.year);
      if (pTerm.orderKey < earliestOrder) {
        earliestOrder = pTerm.orderKey;
      }
    } else if (p.term && p.term !== profile.activeTerm) {
      extraNonStandardTerms.add(p.term);
    }
  });

  // Cap lookback to max 9 recent terms (3 years) for clarity
  const boundedStartOrder = Math.max(earliestOrder, activeParsed.orderKey - 8);
  const evaluatedTerms: ParsedTerm[] = [];
  for (let key = boundedStartOrder; key <= activeParsed.orderKey; key += 1) {
    const year = Math.floor(key / 3);
    const termNum = ((key % 3) + 1) as 1 | 2 | 3;
    evaluatedTerms.push({
      year,
      termNum,
      label: key === activeParsed.orderKey ? profile.activeTerm : `Term ${termNum}, ${year}`,
      orderKey: key,
    });
  }

  const termBreakdowns: TermFeeBreakdown[] = [];
  let delayedTermsCount = 0;
  let unpaidTermsCount = 0;
  let latePaymentCount = 0;
  let priorTermsArrears = 0;
  const flagReasons: string[] = [];

  for (const termObj of evaluatedTerms) {
    const isActiveTerm = termObj.orderKey === activeParsed.orderKey;
    const matchingPayments = allStudentPayments.filter((p) => {
      if (isActiveTerm && p.term === profile.activeTerm) return true;
      const pParsed = parseTermLabel(p.term, activeParsed.year);
      return pParsed.orderKey === termObj.orderKey;
    });

    const paid = matchingPayments.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, netBilled - paid);
    const percentPaid = netBilled > 0 ? Math.min(100, Math.round((paid / netBilled) * 100)) : 100;
    const deadline = getEstimatedTermDeadline(termObj, activeParsed, profile.feeDeadlineDate);
    const latePayments = matchingPayments.filter((p) => p.paymentDate > deadline);
    const lastPaymentDate = matchingPayments[0]?.paymentDate ?? null;

    let delayed = false;
    let reason = 'Cleared on time';

    if (!isActiveTerm) {
      priorTermsArrears += balance;
      if (balance > 0) {
        delayed = true;
        unpaidTermsCount += 1;
        reason =
          paid === 0
            ? `No payment recorded (${formatUGX(balance)} unpaid)`
            : `Partial payment — ${formatUGX(balance)} unpaid`;
        flagReasons.push(`${termObj.label}: ${formatUGX(balance)} carried unpaid`);
      } else if (latePayments.length > 0) {
        delayed = true;
        reason = `Cleared after ${deadline} deadline`;
        flagReasons.push(`${termObj.label}: Paid after fee deadline`);
      }
    } else {
      if (balance > 0) {
        unpaidTermsCount += 1;
        if (todayIso > deadline || percentPaid < 60 || latePayments.length > 0) {
          delayed = true;
          reason =
            todayIso > deadline
              ? `Overdue past ${deadline} (${formatUGX(balance)} left)`
              : `Critical balance — only ${percentPaid}% cleared`;
          flagReasons.push(`${termObj.label}: ${reason}`);
        } else {
          reason = `In progress (${percentPaid}% cleared)`;
        }
      } else if (latePayments.length > 0) {
        delayed = true;
        reason = `Cleared after ${deadline} deadline`;
        flagReasons.push(`${termObj.label}: Paid past deadline`);
      }
    }

    if (delayed) delayedTermsCount += 1;
    latePaymentCount += latePayments.length;

    termBreakdowns.push({
      term: termObj.label,
      billed: netBilled,
      paid,
      balance,
      percentPaid,
      latePaymentsCount: latePayments.length,
      lastPaymentDate,
      delayed,
      reason,
    });
  }

  // Handle any custom/non-standard term names if recorded
  extraNonStandardTerms.forEach((customTerm) => {
    const matching = allStudentPayments.filter((p) => p.term === customTerm);
    const paid = matching.reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, netBilled - paid);
    const percentPaid = netBilled > 0 ? Math.min(100, Math.round((paid / netBilled) * 100)) : 100;
    const delayed = balance > 0;
    if (delayed) {
      delayedTermsCount += 1;
      unpaidTermsCount += 1;
      priorTermsArrears += balance;
      flagReasons.push(`${customTerm}: ${formatUGX(balance)} unpaid`);
    }
    termBreakdowns.push({
      term: customTerm,
      billed: netBilled,
      paid,
      balance,
      percentPaid,
      latePaymentsCount: 0,
      lastPaymentDate: matching[0]?.paymentDate ?? null,
      delayed,
      reason: delayed ? `${formatUGX(balance)} unpaid` : 'Cleared',
    });
  });

  const activeBreakdown = termBreakdowns.find((t) => t.term === profile.activeTerm);
  const activeBalance = activeBreakdown ? activeBreakdown.balance : 0;
  const cumulativeArrears = priorTermsArrears + activeBalance;

  const arrearsMultiplierScore = netBilled > 0 && cumulativeArrears >= netBilled * 1.5 ? 16 : 0;
  const rawScore =
    delayedTermsCount * 28 +
    unpaidTermsCount * 14 +
    Math.min(18, latePaymentCount * 6) +
    arrearsMultiplierScore;
  const riskScore = Math.min(100, rawScore);

  let riskLevel: DefaulterRiskLevel = 'Standard';
  if (delayedTermsCount >= 2 || (unpaidTermsCount >= 2 && cumulativeArrears > 0)) {
    riskLevel = 'High-Risk';
  } else if (delayedTermsCount === 1 && cumulativeArrears > 0) {
    riskLevel = 'Watchlist';
  }

  return {
    termsEvaluatedCount: termBreakdowns.length,
    delayedTermsCount,
    unpaidTermsCount,
    latePaymentCount,
    priorTermsArrears,
    cumulativeArrears,
    riskScore,
    riskLevel,
    flagReasons,
    termBreakdowns,
  };
}

export function computeStudentFeeSummaries(db: SchoolDatabase): StudentFeeSummary[] {
  const classMap = new Map<string, SchoolClass>();
  db.classes.forEach((c) => classMap.set(c.id, c));

  const paymentsByStudent = new Map<string, FeePayment[]>();
  db.feePayments.forEach((p) => {
    const list = paymentsByStudent.get(p.studentId);
    if (list) list.push(p);
    else paymentsByStudent.set(p.studentId, [p]);
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const activeTermParsed = parseTermLabel(db.profile.activeTerm);

  return db.students
    .filter((s) => s.enrollmentStatus === 'Active')
    .map((student) => {
      const schoolClass = classMap.get(student.classId) || null;
      const grossFee = schoolClass ? getClassTotalFee(schoolClass) : 0;
      const discount = Math.min(grossFee, Math.max(0, student.feeDiscount || 0));
      const netBilled = Math.max(0, grossFee - discount);

      const allPayments = (paymentsByStudent.get(student.id) || [])
        .slice()
        .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

      const activeTermPayments = allPayments.filter((p) => {
        if (p.term === db.profile.activeTerm) return true;
        return parseTermLabel(p.term, activeTermParsed.year).orderKey === activeTermParsed.orderKey;
      });

      const totalPaid = activeTermPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, netBilled - totalPaid);
      const percentPaid = netBilled > 0 ? Math.min(100, Math.round((totalPaid / netBilled) * 100)) : 100;

      let feeStatus: FeeClearanceStatus = 'Paid in Full';
      if (balance > 0) {
        feeStatus = percentPaid < 60 ? 'Defaulter' : 'Partial';
      }

      const riskProfile = buildMultiTermRiskProfile(
        student.admissionDate,
        netBilled,
        allPayments,
        db.profile,
        todayIso
      );

      return {
        student,
        schoolClass,
        grossFee,
        discount,
        netBilled,
        totalPaid,
        balance,
        percentPaid,
        feeStatus,
        lastPaymentDate: activeTermPayments[0]?.paymentDate ?? allPayments[0]?.paymentDate ?? null,
        payments: activeTermPayments,
        allPayments,
        riskProfile,
      };
    });
}

export function computeClassFeeSummaries(
  db: SchoolDatabase,
  studentSummaries: StudentFeeSummary[]
): ClassFeeSummary[] {
  return db.classes.map((schoolClass) => {
    const rows = studentSummaries.filter((r) => r.student.classId === schoolClass.id);
    const expectedTotal = rows.reduce((s, r) => s + r.netBilled, 0);
    const collectedTotal = rows.reduce((s, r) => s + r.totalPaid, 0);
    const outstandingTotal = rows.reduce((s, r) => s + r.balance, 0);
    const paidCount = rows.filter((r) => r.feeStatus === 'Paid in Full').length;
    const partialCount = rows.filter((r) => r.feeStatus === 'Partial').length;
    const defaulterCount = rows.filter((r) => r.feeStatus === 'Defaulter').length;
    const collectionRate = expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0;

    return {
      schoolClass,
      studentCount: rows.length,
      feePerStudent: getClassTotalFee(schoolClass),
      expectedTotal,
      collectedTotal,
      outstandingTotal,
      paidCount,
      partialCount,
      defaulterCount,
      collectionRate,
    };
  });
}

export interface CashbookEntry {
  id: string;
  date: string;
  reference: string;
  type: 'Fee Inflow' | 'Payroll Outflow' | 'School Expense';
  party: string;
  category: string;
  method: string;
  inflow: number;
  outflow: number;
}

export function computeFinancialOverview(db: SchoolDatabase, activeMonth?: string) {
  const targetMonth = activeMonth || db.profile.activeMonth;
  const studentSummaries = computeStudentFeeSummaries(db);
  const classSummaries = computeClassFeeSummaries(db, studentSummaries);

  const totalExpectedFees = studentSummaries.reduce((s, r) => s + r.netBilled, 0);
  const totalCollectedFees = studentSummaries.reduce((s, r) => s + r.totalPaid, 0);
  const totalFeeArrears = studentSummaries.reduce((s, r) => s + r.balance, 0);
  const feeCollectionRate =
    totalExpectedFees > 0 ? Math.round((totalCollectedFees / totalExpectedFees) * 100) : 0;

  const defaulterStudents = studentSummaries.filter((r) => r.feeStatus === 'Defaulter');
  const allOwingStudents = studentSummaries.filter((r) => r.balance > 0);
  const highRiskDefaulters = studentSummaries
    .filter((r) => r.riskProfile.riskLevel === 'High-Risk')
    .sort(
      (a, b) =>
        b.riskProfile.riskScore - a.riskProfile.riskScore ||
        b.riskProfile.cumulativeArrears - a.riskProfile.cumulativeArrears
    );

  const staffMap = new Map(db.staff.map((st) => [st.id, st]));
  const monthPayroll = db.payroll.filter((p) => p.month === targetMonth);
  const teachingMonthPayroll = monthPayroll.filter((p) => staffMap.get(p.staffId)?.category === 'Teaching');
  const nonTeachingMonthPayroll = monthPayroll.filter((p) => staffMap.get(p.staffId)?.category === 'Non-Teaching');

  const monthTeachingTotal =
    monthPayroll.length > 0
      ? teachingMonthPayroll.reduce((s, p) => s + p.netPay, 0)
      : db.staff
          .filter((s) => s.category === 'Teaching')
          .reduce((s, st) => s + Math.max(0, st.baseSalary + st.housingAllowance + st.transportAllowance - st.taxDeduction - st.pensionDeduction), 0);

  const monthNonTeachingTotal =
    monthPayroll.length > 0
      ? nonTeachingMonthPayroll.reduce((s, p) => s + p.netPay, 0)
      : db.staff
          .filter((s) => s.category === 'Non-Teaching')
          .reduce((s, st) => s + Math.max(0, st.baseSalary + st.housingAllowance + st.transportAllowance - st.taxDeduction - st.pensionDeduction), 0);

  const monthPayrollTotal = monthTeachingTotal + monthNonTeachingTotal;
  const monthPayrollPaid = monthPayroll.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.netPay, 0);
  const monthPayrollPending = monthPayroll.filter((p) => p.status === 'Pending').reduce((s, p) => s + p.netPay, 0);

  const termPayrollPaid = db.payroll.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.netPay, 0);
  const termTeachingPayrollPaid = db.payroll
    .filter((p) => p.status === 'Paid' && staffMap.get(p.staffId)?.category === 'Teaching')
    .reduce((s, p) => s + p.netPay, 0);
  const termNonTeachingPayrollPaid = db.payroll
    .filter((p) => p.status === 'Paid' && staffMap.get(p.staffId)?.category === 'Non-Teaching')
    .reduce((s, p) => s + p.netPay, 0);

  const approvedPaidExpenses = db.expenses
    .filter((e) => e.approvalStatus === 'Approved' && e.paidStatus === 'Paid')
    .reduce((s, e) => s + e.amount, 0);
  const pendingApprovalExpenses = db.expenses.filter((e) => e.approvalStatus === 'Pending Owner Approval');
  const pendingApprovalTotal = pendingApprovalExpenses.reduce((s, e) => s + e.amount, 0);

  const totalTermOutflows = termPayrollPaid + approvedPaidExpenses;
  const netCashSurplus = totalCollectedFees - totalTermOutflows;

  const expenseByCategoryMap = new Map<string, number>();
  db.expenses
    .filter((e) => e.approvalStatus === 'Approved')
    .forEach((e) => {
      expenseByCategoryMap.set(e.category, (expenseByCategoryMap.get(e.category) || 0) + e.amount);
    });
  const expenseByCategory = Array.from(expenseByCategoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const studentMap = new Map(db.students.map((st) => [st.id, st]));
  const classMap = new Map(db.classes.map((c) => [c.id, c]));

  const cashbook: CashbookEntry[] = [
    ...db.feePayments.map((p) => {
      const stu = studentMap.get(p.studentId);
      const cls = stu ? classMap.get(stu.classId) : undefined;
      return {
        id: p.id,
        date: p.paymentDate,
        reference: p.receiptNo,
        type: 'Fee Inflow' as const,
        party: stu ? `${stu.fullName} (${cls?.name || ''})` : 'Student',
        category: 'School Fees',
        method: p.method,
        inflow: p.amount,
        outflow: 0,
      };
    }),
    ...db.payroll
      .filter((p) => p.status === 'Paid' && p.paidDate)
      .map((p) => {
        const st = staffMap.get(p.staffId);
        return {
          id: p.id,
          date: p.paidDate || '',
          reference: p.voucherNo,
          type: 'Payroll Outflow' as const,
          party: st ? `${st.fullName} (${st.roleTitle})` : 'Staff',
          category: st?.category === 'Teaching' ? 'Teaching Salary' : 'Non-Teaching Salary',
          method: p.paymentMethod,
          inflow: 0,
          outflow: p.netPay,
        };
      }),
    ...db.expenses
      .filter((e) => e.approvalStatus === 'Approved' && e.paidStatus === 'Paid')
      .map((e) => ({
        id: e.id,
        date: e.date,
        reference: e.voucherNo,
        type: 'School Expense' as const,
        party: e.vendor,
        category: e.category,
        method: e.paymentMethod,
        inflow: 0,
        outflow: e.amount,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return {
    studentSummaries,
    classSummaries,
    totalExpectedFees,
    totalCollectedFees,
    totalFeeArrears,
    feeCollectionRate,
    defaulterStudents,
    allOwingStudents,
    highRiskDefaulters,
    monthTeachingTotal,
    monthNonTeachingTotal,
    monthPayrollTotal,
    monthPayrollPaid,
    monthPayrollPending,
    termPayrollPaid,
    termTeachingPayrollPaid,
    termNonTeachingPayrollPaid,
    approvedPaidExpenses,
    pendingApprovalExpenses,
    pendingApprovalTotal,
    totalTermOutflows,
    netCashSurplus,
    expenseByCategory,
    cashbook,
  };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const lines = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))];
  const csvWithBom = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export type StudentFeeExportStatusFilter = 'ALL' | 'Owing' | 'Paid in Full' | 'Partial' | 'Defaulter';

export function getFilteredStudentFeeRows(
  db: SchoolDatabase,
  options?: {
    classId?: string;
    status?: StudentFeeExportStatusFilter;
    search?: string;
  }
): StudentFeeSummary[] {
  const summaries = computeStudentFeeSummaries(db);
  return summaries.filter((row) => {
    if (options?.classId && options.classId !== 'ALL' && row.student.classId !== options.classId) {
      return false;
    }
    if (options?.status && options.status !== 'ALL') {
      if (options.status === 'Owing') {
        if (row.balance <= 0) return false;
      } else if (row.feeStatus !== options.status) {
        return false;
      }
    }
    if (options?.search && options.search.trim()) {
      const q = options.search.toLowerCase();
      return (
        row.student.fullName.toLowerCase().includes(q) ||
        row.student.admissionNo.toLowerCase().includes(q) ||
        row.student.guardianName.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function exportStudentFeeRecordsCsv(
  db: SchoolDatabase,
  options?: {
    classId?: string;
    status?: StudentFeeExportStatusFilter;
    search?: string;
  }
): { filename: string; rowCount: number } {
  const rows = getFilteredStudentFeeRows(db, options);
  const filename = `student-fee-records-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Student ID',
      'Student Name',
      'Class',
      'Stream',
      'Boarding Status',
      'Guardian Name',
      'Guardian Phone',
      'Term',
      'Gross Term Fee (UGX)',
      'Discount / Bursary (UGX)',
      'Net Fee Billed (UGX)',
      'Total Paid (UGX)',
      'Balance Owed (UGX)',
      'Percent Paid',
      'Fee Status',
      'Last Payment Date',
      'Last Receipt #',
    ],
    rows.map((r) => [
      r.student.admissionNo,
      r.student.fullName,
      r.schoolClass?.name || 'Unassigned',
      r.schoolClass?.stream || '',
      r.student.boardingStatus,
      r.student.guardianName,
      r.student.guardianPhone,
      db.profile.activeTerm,
      r.grossFee,
      r.discount,
      r.netBilled,
      r.totalPaid,
      r.balance,
      `${r.percentPaid}%`,
      r.feeStatus,
      r.lastPaymentDate || '',
      r.payments[0]?.receiptNo || '',
    ])
  );
  return { filename, rowCount: rows.length };
}

export function exportFeePaymentsCsv(
  db: SchoolDatabase,
  options?: { classId?: string }
): { filename: string; rowCount: number } {
  const studentMap = new Map(db.students.map((s) => [s.id, s]));
  const classMap = new Map(db.classes.map((c) => [c.id, c]));

  const filteredPayments = db.feePayments
    .filter((p) => {
      if (!options?.classId || options.classId === 'ALL') return true;
      const stu = studentMap.get(p.studentId);
      return stu?.classId === options.classId;
    })
    .slice()
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  const filename = `student-fee-receipts-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Receipt #',
      'Payment Date',
      'Term',
      'Student ID',
      'Student Name',
      'Class',
      'Boarding Status',
      'Payment Method',
      'Amount Paid (UGX)',
      'Recorded By',
      'Notes',
    ],
    filteredPayments.map((p) => {
      const stu = studentMap.get(p.studentId);
      const cls = stu ? classMap.get(stu.classId) : undefined;
      return [
        p.receiptNo,
        p.paymentDate,
        p.term,
        stu?.admissionNo || '',
        stu?.fullName || 'Student',
        cls ? `${cls.name} (${cls.stream})` : 'Unassigned',
        stu?.boardingStatus || '',
        p.method,
        p.amount,
        p.recordedBy,
        p.notes,
      ];
    })
  );
  return { filename, rowCount: filteredPayments.length };
}

export function exportClassFeeSummaryCsv(db: SchoolDatabase): { filename: string; rowCount: number } {
  const fin = computeFinancialOverview(db);
  const filename = `class-fee-summary-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Class',
      'Stream',
      'Active Students',
      'Fee per Student (UGX)',
      'Expected Term Total (UGX)',
      'Collected Total (UGX)',
      'Outstanding Balance (UGX)',
      'Paid in Full Count',
      'Partial Payment Count',
      'Critical Defaulters Count',
      'Collection Rate',
    ],
    fin.classSummaries.map((c) => [
      c.schoolClass.name,
      c.schoolClass.stream,
      c.studentCount,
      c.feePerStudent,
      c.expectedTotal,
      c.collectedTotal,
      c.outstandingTotal,
      c.paidCount,
      c.partialCount,
      c.defaulterCount,
      `${c.collectionRate}%`,
    ])
  );
  return { filename, rowCount: fin.classSummaries.length };
}

export function exportDefaultersCsv(
  db: SchoolDatabase,
  options?: { scope?: 'critical' | 'all_owing' | 'high_risk'; classId?: string }
): { filename: string; rowCount: number } {
  const fin = computeFinancialOverview(db);
  const base =
    options?.scope === 'high_risk'
      ? fin.highRiskDefaulters
      : options?.scope === 'critical'
      ? fin.defaulterStudents
      : fin.allOwingStudents;
  const rows = base
    .filter((r) => (!options?.classId || options.classId === 'ALL' ? true : r.student.classId === options.classId))
    .slice()
    .sort((a, b) =>
      options?.scope === 'high_risk'
        ? b.riskProfile.riskScore - a.riskProfile.riskScore || b.riskProfile.cumulativeArrears - a.riskProfile.cumulativeArrears
        : b.balance - a.balance
    );

  const filename =
    options?.scope === 'high_risk'
      ? `high-risk-multi-term-defaulters-${todayStamp()}.csv`
      : `school-fee-defaulters-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Student ID',
      'Student Name',
      'Class',
      'Boarding Status',
      'Guardian Name',
      'Guardian Phone',
      'Active Term Net Billed (UGX)',
      'Active Term Paid (UGX)',
      'Active Term Balance Due (UGX)',
      'Percent Paid',
      'Fee Status',
      'Risk Level',
      'Risk Score',
      'Delayed Terms',
      'Cumulative Multi-Term Arrears (UGX)',
      'Delay History Reasons',
    ],
    rows.map((r) => [
      r.student.admissionNo,
      r.student.fullName,
      r.schoolClass ? `${r.schoolClass.name} (${r.schoolClass.stream})` : 'Unassigned',
      r.student.boardingStatus,
      r.student.guardianName,
      r.student.guardianPhone,
      r.netBilled,
      r.totalPaid,
      r.balance,
      `${r.percentPaid}%`,
      r.feeStatus,
      r.riskProfile.riskLevel,
      r.riskProfile.riskScore,
      `${r.riskProfile.delayedTermsCount}/${r.riskProfile.termsEvaluatedCount}`,
      r.riskProfile.cumulativeArrears,
      r.riskProfile.flagReasons.join(' | '),
    ])
  );
  return { filename, rowCount: rows.length };
}

export function exportIncomeExpenditureCsv(db: SchoolDatabase): { filename: string; rowCount: number } {
  const fin = computeFinancialOverview(db);
  const rows: Array<Array<string | number>> = [
    ['School Name', 'Metadata', db.profile.schoolName],
    ['Active Term', 'Metadata', db.profile.activeTerm],
    ['Report Date', 'Metadata', todayStamp()],
    ['Gross Term Fees Billed', 'Fee Billing', fin.totalExpectedFees],
    ['Actual School Fees Collected (Cash Inflow)', 'Income', fin.totalCollectedFees],
    ['Uncollected Fee Arrears (Receivable)', 'Receivable', fin.totalFeeArrears],
    ['Fee Collection Rate', 'Metric', `${fin.feeCollectionRate}%`],
    ['Teaching Staff Salaries Disbursed', 'Payroll Outflow', -fin.termTeachingPayrollPaid],
    ['Non-Teaching Staff Salaries Disbursed', 'Payroll Outflow', -fin.termNonTeachingPayrollPaid],
    ...fin.expenseByCategory.map((c) => [c.category, 'Operating Expense', -c.amount]),
    ['Pending Owner Approval Expenses', 'Pending Commitment', fin.pendingApprovalTotal],
    ['Total Cash Outflows Disbursed', 'Total Outflows', -fin.totalTermOutflows],
    ['Net Term Cash Position (Surplus / Deficit)', 'Net Position', fin.netCashSurplus],
  ];
  const filename = `financial-income-expenditure-${todayStamp()}.csv`;
  downloadCsv(filename, ['Line Item', 'Section / Category', 'Amount (UGX) / Value'], rows);
  return { filename, rowCount: rows.length };
}

export function exportCashbookCsv(db: SchoolDatabase): { filename: string; rowCount: number } {
  const fin = computeFinancialOverview(db);
  const chronological = fin.cashbook.slice().reverse();
  let runningNet = 0;
  const withRunning = chronological.map((entry) => {
    runningNet += entry.inflow - entry.outflow;
    return { entry, runningNet };
  });
  const ordered = withRunning.reverse();

  const filename = `school-general-cashbook-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    ['Date', 'Reference #', 'Entry Type', 'Party / Payee', 'Category', 'Payment Method', 'Money In (UGX)', 'Money Out (UGX)', 'Running Net (UGX)'],
    ordered.map(({ entry, runningNet: net }) => [
      entry.date,
      entry.reference,
      entry.type,
      entry.party,
      entry.category,
      entry.method,
      entry.inflow,
      entry.outflow,
      net,
    ])
  );
  return { filename, rowCount: ordered.length };
}

export function exportExpensesCsv(
  db: SchoolDatabase,
  categoryFilter: string = 'ALL'
): { filename: string; rowCount: number } {
  const rows = db.expenses.filter((e) => (categoryFilter === 'ALL' ? true : e.category === categoryFilter));
  const filename = `school-expenses-register-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    ['Voucher #', 'Date', 'Category', 'Vendor', 'Description', 'Payment Method', 'Requested By', 'Approval Status', 'Payment Status', 'Amount (UGX)', 'Notes'],
    rows.map((e) => [
      e.voucherNo,
      e.date,
      e.category,
      e.vendor,
      e.description,
      e.paymentMethod,
      e.requestedBy,
      e.approvalStatus,
      e.paidStatus,
      e.amount,
      e.notes,
    ])
  );
  return { filename, rowCount: rows.length };
}

export function exportPayrollCsv(
  db: SchoolDatabase,
  month: string,
  categoryFilter: 'ALL' | 'Teaching' | 'Non-Teaching' = 'ALL'
): { filename: string; rowCount: number } {
  const payrollMap = new Map(db.payroll.filter((p) => p.month === month).map((p) => [p.staffId, p]));
  const staffList = db.staff.filter((s) => (categoryFilter === 'ALL' ? true : s.category === categoryFilter));

  const filename = `staff-payroll-${month}-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Employee #',
      'Staff Name',
      'Category',
      'Role / Title',
      'Department',
      'Bank / Mobile Account',
      'Payroll Month',
      'Base Salary (UGX)',
      'Allowances (UGX)',
      'Deductions (UGX)',
      'Net Pay (UGX)',
      'Status',
      'Paid Date',
      'Voucher #',
    ],
    staffList.map((member) => {
      const rec = payrollMap.get(member.id);
      const baseSalary = rec ? rec.baseSalary : member.baseSalary;
      const allowances = rec ? rec.allowances : member.housingAllowance + member.transportAllowance;
      const deductions = rec ? rec.deductions : member.taxDeduction + member.pensionDeduction;
      const netPay = rec ? rec.netPay : Math.max(0, baseSalary + allowances - deductions);
      return [
        member.employeeNo,
        member.fullName,
        member.category,
        member.roleTitle,
        member.department,
        member.bankAccount,
        month,
        baseSalary,
        allowances,
        deductions,
        netPay,
        rec?.status || 'Pending',
        rec?.paidDate || '',
        rec?.voucherNo || `SAL-${month.replace('-', '')}-${member.employeeNo.replace('EMP-', '')}`,
      ];
    })
  );
  return { filename, rowCount: staffList.length };
}

export type DefaulterSmsTier = 'gentle' | 'firm' | 'urgent';

export function getRecommendedSmsTier(summary: StudentFeeSummary): DefaulterSmsTier {
  if (summary.percentPaid < 30 || summary.totalPaid === 0) {
    return 'urgent';
  }
  if (summary.percentPaid < 60) {
    return 'firm';
  }
  return 'gentle';
}

export function getSmsTierLabel(tier: DefaulterSmsTier): string {
  if (tier === 'urgent') return 'Urgent Final Notice (<30% Paid)';
  if (tier === 'firm') return 'Firm Balance Notice (30%–59% Paid)';
  return 'Gentle Balance Reminder (60%+ Paid)';
}

export function generateDefaulterSmsText(
  summary: StudentFeeSummary,
  profile: SchoolProfile,
  options?: {
    tier?: DefaulterSmsTier;
    paymentChannelNote?: string;
  }
): string {
  const tier = options?.tier || getRecommendedSmsTier(summary);
  const guardian = summary.student.guardianName || 'Parent/Guardian';
  const studentName = summary.student.fullName;
  const studentId = summary.student.admissionNo;
  const className = summary.schoolClass ? summary.schoolClass.name : 'Class';
  const balanceText = formatUGX(summary.balance);
  const paidText = formatUGX(summary.totalPaid);
  const billedText = formatUGX(summary.netBilled);
  const deadline = profile.feeDeadlineDate || 'end of week';
  const contactPhone = profile.phone ? ` Inquiries: ${profile.phone}.` : '';
  const channelNote = (
    options?.paymentChannelNote ||
    "Pay via School Bank / Mobile Money or visit the Bursar's Office."
  ).trim();

  if (tier === 'urgent') {
    return (
      `${profile.schoolName} (${profile.activeTerm}): URGENT FEE NOTICE for ${guardian}. ` +
      `${studentName} (${studentId}, ${className}) has paid ${paidText} out of ${billedText} (${summary.percentPaid}% cleared). ` +
      `Outstanding balance is ${balanceText}. Please clear immediately by ${deadline} to avoid class disruption. ` +
      `${channelNote}${contactPhone}`
    );
  }

  if (tier === 'firm') {
    return (
      `${profile.schoolName} (${profile.activeTerm}): Dear ${guardian}, fee balance notice for ${studentName} ` +
      `(${studentId}, ${className}). Paid: ${paidText}; Balance due: ${balanceText} (${summary.percentPaid}% cleared). ` +
      `Kindly clear by ${deadline}. ${channelNote}${contactPhone}`
    );
  }

  return (
    `${profile.schoolName} (${profile.activeTerm}): Dear ${guardian}, thank you for your payments (${paidText}) for ` +
    `${studentName} (${className}). Kindly clear the remaining balance of ${balanceText} by ${deadline}. ` +
    `${channelNote}${contactPhone}`
  );
}

export function exportDefaulterSmsCsv(
  rows: StudentFeeSummary[],
  profile: SchoolProfile,
  options?: {
    tierOverride?: 'auto' | DefaulterSmsTier;
    paymentChannelNote?: string;
  }
): { filename: string; rowCount: number } {
  const filename = `defaulter-sms-templates-${todayStamp()}.csv`;
  downloadCsv(
    filename,
    [
      'Guardian Name',
      'Guardian Phone',
      'Student ID',
      'Student Name',
      'Class',
      'Net Billed (UGX)',
      'Paid (UGX)',
      'Balance Owed (UGX)',
      '% Cleared',
      'SMS Tier',
      'Ready-to-Send SMS Message',
    ],
    rows.map((r) => {
      const tier =
        options?.tierOverride && options.tierOverride !== 'auto'
          ? options.tierOverride
          : getRecommendedSmsTier(r);
      const message = generateDefaulterSmsText(r, profile, {
        tier,
        paymentChannelNote: options?.paymentChannelNote,
      });
      return [
        r.student.guardianName,
        r.student.guardianPhone,
        r.student.admissionNo,
        r.student.fullName,
        r.schoolClass?.name || 'Unassigned',
        r.netBilled,
        r.totalPaid,
        r.balance,
        `${r.percentPaid}%`,
        getSmsTierLabel(tier),
        message,
      ];
    })
  );
  return { filename, rowCount: rows.length };
}


