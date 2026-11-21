import React, { useState } from 'react';
import { AlertTriangle, CalendarCheck, Check, GraduationCap, Megaphone, Plus, Search, Users } from 'lucide-react';
import type { SchoolDatabase, StaffCategory } from '../shared/types';
import { computeFinancialOverview, formatUGX } from '../utils/schoolFinance';

export type HeadTeacherView = 'overview' | 'students' | 'staff' | 'notices';

export function HeadTeacherDashboard({
  db,
  activeView,
  onNavigate,
  onUpdateStudent,
  onUpdateStaff,
  onPostNotice,
  onOpenExpenseModal,
}: {
  db: SchoolDatabase;
  activeView: HeadTeacherView;
  onNavigate: (view: HeadTeacherView) => void;
  onUpdateStudent: (
    studentId: string,
    patch: { attendanceRate?: number; academicAverage?: number; notes?: string }
  ) => Promise<void>;
  onUpdateStaff: (staffId: string, patch: { status?: 'Active' | 'On Leave'; performanceNote?: string }) => Promise<void>;
  onPostNotice: (notice: {
    title: string;
    audience: 'All Staff' | 'Teaching Staff' | 'Parents & Guardians' | 'Leadership';
    body: string;
    priority: 'Standard' | 'Urgent';
  }) => Promise<void>;
  onOpenExpenseModal: () => void;
}) {
  const fin = computeFinancialOverview(db);

  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState<'ALL' | StaffCategory>('ALL');

  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<
    'All Staff' | 'Teaching Staff' | 'Parents & Guardians' | 'Leadership'
  >('All Staff');
  const [noticePriority, setNoticePriority] = useState<'Standard' | 'Urgent'>('Standard');
  const [noticeBody, setNoticeBody] = useState('');
  const [postingNotice, setPostingNotice] = useState(false);

  const avgAttendance =
    fin.studentSummaries.length > 0
      ? Math.round(fin.studentSummaries.reduce((s, r) => s + r.student.attendanceRate, 0) / fin.studentSummaries.length)
      : 0;
  const teachingCount = db.staff.filter((s) => s.category === 'Teaching').length;
  const nonTeachingCount = db.staff.filter((s) => s.category === 'Non-Teaching').length;

  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeBody.trim()) return;
    setPostingNotice(true);
    try {
      await onPostNotice({
        title: noticeTitle.trim(),
        audience: noticeAudience,
        body: noticeBody.trim(),
        priority: noticePriority,
      });
      setNoticeTitle('');
      setNoticeBody('');
    } finally {
      setPostingNotice(false);
    }
  };

  if (activeView === 'students') {
    const filtered = fin.studentSummaries.filter((row) => {
      if (selectedClassId !== 'ALL' && row.student.classId !== selectedClassId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
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
            <h2 className="text-xl font-semibold text-slate-900">Class & Student Academic + Fee Standing</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Inspect admitted students by class, attendance rate, special needs support, and UGX fee clearance.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or ID..."
                className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg w-56"
              />
            </div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Classes ({fin.studentSummaries.length})</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stream})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No students match the selected filter. Admit students in the Registrar dashboard to view them here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Student ID</th>
                    <th className="py-2.5 px-4">Student & Guardian</th>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4 text-right">Attendance %</th>
                    <th className="py-2.5 px-4 text-right">Academic Avg %</th>
                    <th className="py-2.5 px-4 text-right">Paid (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Balance (UGX)</th>
                    <th className="py-2.5 px-4 text-right">Fee Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filtered.map((row) => (
                    <tr key={row.student.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono text-xs text-blue-700 font-semibold">
                        {row.student.admissionNo}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{row.student.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {row.student.guardianName} · {row.student.guardianPhone}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{row.schoolClass?.name || '—'}</td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          key={`${row.student.id}-att-${row.student.attendanceRate}`}
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={row.student.attendanceRate}
                          aria-label={`Attendance percentage for ${row.student.fullName}`}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val >= 0 && val <= 100 && val !== row.student.attendanceRate) {
                              onUpdateStudent(row.student.id, { attendanceRate: val });
                            }
                          }}
                          className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded-md bg-white"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <input
                          key={`${row.student.id}-avg-${row.student.academicAverage}`}
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={row.student.academicAverage}
                          aria-label={`Academic average for ${row.student.fullName}`}
                          onBlur={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val >= 0 && val <= 100 && val !== row.student.academicAverage) {
                              onUpdateStudent(row.student.id, { academicAverage: val });
                            }
                          }}
                          className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded-md bg-white"
                        />
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {formatUGX(row.totalPaid)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700">
                        {formatUGX(row.balance)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs font-medium">
                        <span
                          className={
                            row.feeStatus === 'Paid in Full'
                              ? 'text-emerald-700'
                              : row.feeStatus === 'Partial'
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }
                        >
                          {row.feeStatus} ({row.percentPaid}%)
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

  if (activeView === 'staff') {
    const staffRows = db.staff.filter((s) => (staffFilter === 'ALL' ? true : s.category === staffFilter));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Teaching & Non-Teaching Staff Roster</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Supervise teaching workloads, support personnel assignments, and staff duty status.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'Teaching', 'Non-Teaching'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setStaffFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    staffFilter === cat ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat === 'ALL'
                    ? `All Staff (${db.staff.length})`
                    : `${cat} (${db.staff.filter((s) => s.category === cat).length})`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenExpenseModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Request Dept. Expense
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {staffRows.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No staff members recorded yet. Add teaching and non-teaching staff in the Bursar Payroll module.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Emp #</th>
                    <th className="py-2.5 px-4">Staff Member</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Assigned Class / Area</th>
                    <th className="py-2.5 px-4 text-right">Attendance</th>
                    <th className="py-2.5 px-4">Notes</th>
                    <th className="py-2.5 px-4 text-right">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {staffRows.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{member.employeeNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{member.fullName}</div>
                        <div className="text-xs text-slate-500">
                          {member.roleTitle} · {member.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">{member.category}</td>
                      <td className="py-3 px-4 text-slate-700">{member.assignedClassesOrArea}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {member.attendanceRate}%
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">{member.performanceNote || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateStaff(member.id, {
                              status: member.status === 'Active' ? 'On Leave' : 'Active',
                            })
                          }
                          className={`text-xs font-medium hover:underline ${
                            member.status === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {member.status}
                        </button>
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

  if (activeView === 'notices') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Campus Bulletins & Circulars</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Publish official notices for teaching staff, parents, and school leadership.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleNoticeSubmit}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-200">Publish New Notice</h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Notice Title</label>
              <input
                type="text"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="Announcement subject"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Audience</label>
                <select
                  value={noticeAudience}
                  onChange={(e) =>
                    setNoticeAudience(
                      e.target.value as 'All Staff' | 'Teaching Staff' | 'Parents & Guardians' | 'Leadership'
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="All Staff">All Staff</option>
                  <option value="Teaching Staff">Teaching Staff</option>
                  <option value="Parents & Guardians">Parents &amp; Guardians</option>
                  <option value="Leadership">Leadership</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={noticePriority}
                  onChange={(e) => setNoticePriority(e.target.value as 'Standard' | 'Urgent')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="Standard">Standard</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Message Body</label>
              <textarea
                rows={4}
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
                placeholder="Write the official announcement..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={postingNotice}
              className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 disabled:opacity-50"
            >
              {postingNotice ? 'Publishing...' : 'Publish Campus Notice'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            {db.notices.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                No campus notices published yet.
              </div>
            ) : (
              db.notices.map((n) => (
                <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      {n.audience} · {n.date}
                    </span>
                    <span className={n.priority === 'Urgent' ? 'font-semibold text-red-700' : 'text-slate-600'}>
                      {n.priority}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-slate-900 mt-1">{n.title}</h4>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">{n.body}</p>
                  <div className="text-xs text-slate-500 mt-3">Issued by {n.author}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Head Teacher / Headmaster Overview
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#0F4C5C] via-[#0E7490] to-[#059669] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Head Teacher / Headmaster Overview
          </h2>
          <p className="text-xs sm:text-sm text-teal-50">
            {db.profile.activeTerm} · Check students, attendance, teachers, and post school notices easily.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenExpenseModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-teal-50 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-teal-700" />
          Request School Expense
        </button>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigate('students')}
          className="bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">1. Students &amp; Marks</div>
            <div className="text-xs text-slate-500 truncate">Update attendance &amp; exam marks</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('staff')}
          className="bg-white border border-slate-200/90 hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">2. Teachers &amp; Staff</div>
            <div className="text-xs text-slate-500 truncate">See teaching &amp; support duty list</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('notices')}
          className="bg-white border border-slate-200/90 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">3. Send a Notice</div>
            <div className="text-xs text-slate-500 truncate">Write message to staff or parents</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenExpenseModal}
          className="bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">4. Request Supplies</div>
            <div className="text-xs text-slate-500 truncate">Ask for school books or repairs</div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Active Enrollment</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-800 flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-indigo-950 tabular-nums mt-1">
            {fin.studentSummaries.length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Across {db.classes.length} active classes</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">School Workforce</div>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">{db.staff.length}</div>
          <div className="text-xs text-slate-500 mt-3">
            {teachingCount} Teaching · {nonTeachingCount} Non-Teaching
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Average Attendance</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1">{avgAttendance}%</div>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, avgAttendance)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500">Term-to-date student attendance</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Fee Clearance Warnings</div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-700 tabular-nums mt-1">
            {fin.defaulterStudents.length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Students below 60% fee clearance</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Class Roster & Fee Clearance Summary</h3>
            <span className="text-xs text-slate-500">Class Teachers &amp; Capacity</span>
          </div>
          {fin.classSummaries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No classes created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4">Class Teacher</th>
                    <th className="py-2.5 px-4 text-right">Enrolled</th>
                    <th className="py-2.5 px-4 text-right">Cleared</th>
                    <th className="py-2.5 px-4 text-right">Defaulters</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {fin.classSummaries.map((cls) => {
                    const teacher = db.staff.find((s) => s.id === cls.schoolClass.classTeacherId);
                    const clearRate = cls.studentCount > 0 ? Math.round((cls.paidCount / cls.studentCount) * 100) : 0;
                    return (
                      <tr key={cls.schoolClass.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-900">{cls.schoolClass.name}</div>
                          <div className="text-xs text-slate-500">{cls.schoolClass.room}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 text-xs">{teacher?.fullName || 'Unassigned'}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                          {cls.studentCount}/{cls.schoolClass.capacity}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-emerald-600 rounded-full"
                                style={{ width: `${Math.min(100, clearRate)}%` }}
                              />
                            </div>
                            <span>{cls.paidCount}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-rose-700">
                          {cls.defaulterCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">Active Campus Notices</h3>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          {db.notices.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No notices published yet.</div>
          ) : (
            <div className="space-y-4">
              {db.notices.slice(0, 3).map((n) => (
                <div key={n.id} className="pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{n.audience}</span>
                    <span className={n.priority === 'Urgent' ? 'text-rose-700 font-medium' : 'text-slate-500'}>
                      {n.date}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">{n.title}</div>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.body}</p>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-xs text-emerald-800">
            <Check className="w-4 h-4 shrink-0" />
            <span>Teaching &amp; support rosters synchronized with Bursar UGX payroll.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
