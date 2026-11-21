import React, { useState } from 'react';
import { BookOpen, Building2, CalendarCheck, Download, Eye, Plus, Search, ShieldAlert, UserPlus, Users, Wallet } from 'lucide-react';
import type { EnrollmentStatus, SchoolClass, SchoolDatabase, Student } from '../shared/types';
import { computeFinancialOverview, downloadCsv, formatUGX, getClassTotalFee } from '../utils/schoolFinance';

export type RegistrarView = 'admissions' | 'classes' | 'attendance';

export function RegistrarDashboard({
  db,
  activeView,
  onNavigate,
  onOpenEnrollModal,
  onOpenAddClassModal,
  onOpenStudentDossier,
  onUpdateClass,
  onUpdateStudent,
}: {
  db: SchoolDatabase;
  activeView: RegistrarView;
  onNavigate: (view: RegistrarView) => void;
  onOpenEnrollModal: () => void;
  onOpenAddClassModal: () => void;
  onOpenStudentDossier: (student: Student) => void;
  onUpdateClass: (
    classId: string,
    patch: Partial<Pick<SchoolClass, 'tuitionFee' | 'lunchFee' | 'activityFee' | 'capacity' | 'classTeacherId'>>
  ) => Promise<void>;
  onUpdateStudent: (
    studentId: string,
    patch: { enrollmentStatus?: EnrollmentStatus; attendanceRate?: number; academicAverage?: number; classId?: string }
  ) => Promise<void>;
}) {
  const fin = computeFinancialOverview(db);

  const [classFilter, setClassFilter] = useState('ALL');
  const [boardingFilter, setBoardingFilter] = useState<'ALL' | 'Day Scholar' | 'Boarding'>('ALL');
  const [specialNeedsOnly, setSpecialNeedsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [feeDraft, setFeeDraft] = useState({ tuitionFee: 0, lunchFee: 0, activityFee: 0 });

  const teachingStaff = db.staff.filter((s) => s.category === 'Teaching');

  if (activeView === 'classes') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Classes, Streams & UGX Fee Structures</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Create classes, assign class teachers, and set term tuition, meal, and activity fees in UGX.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddClassModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Class
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {db.classes.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-medium text-slate-900">No classes created yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Add your school classes (for example, Baby Class, Primary 1–7, or Senior 1–4) and define their term fees in Ugandan Shillings.
              </p>
              <button
                type="button"
                onClick={onOpenAddClassModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Create First Class
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Class & Room</th>
                    <th className="py-2.5 px-4">Class Teacher</th>
                    <th className="py-2.5 px-4 text-right">Enrolled / Cap</th>
                    <th className="py-2.5 px-4 text-right">Tuition</th>
                    <th className="py-2.5 px-4 text-right">Meals</th>
                    <th className="py-2.5 px-4 text-right">Activity</th>
                    <th className="py-2.5 px-4 text-right">Total Term Fee</th>
                    <th className="py-2.5 px-4 text-right">Edit Fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {db.classes.map((cls) => {
                    const enrolled = db.students.filter(
                      (s) => s.classId === cls.id && s.enrollmentStatus === 'Active'
                    ).length;
                    const isEditing = editingClassId === cls.id;
                    const capPct = cls.capacity > 0 ? Math.min(100, Math.round((enrolled / cls.capacity) * 100)) : 0;
                    return (
                      <tr key={cls.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {cls.name} · {cls.stream}
                          </div>
                          <div className="text-xs text-slate-500">{cls.room}</div>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={cls.classTeacherId}
                            onChange={(e) => onUpdateClass(cls.id, { classTeacherId: e.target.value })}
                            className="text-xs bg-white border border-slate-300 rounded-md px-2 py-1 text-slate-700"
                          >
                            <option value="">Unassigned</option>
                            {teachingStaff.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.fullName}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div
                                className={`h-full rounded-full ${
                                  capPct >= 95 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                                style={{ width: `${capPct}%` }}
                              />
                            </div>
                            <span>
                              {enrolled}/{cls.capacity}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              value={feeDraft.tuitionFee}
                              onChange={(e) => setFeeDraft({ ...feeDraft, tuitionFee: Number(e.target.value) })}
                              className="w-28 px-2 py-1 text-xs border border-slate-300 rounded text-right"
                            />
                          ) : (
                            formatUGX(cls.tuitionFee)
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              value={feeDraft.lunchFee}
                              onChange={(e) => setFeeDraft({ ...feeDraft, lunchFee: Number(e.target.value) })}
                              className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-right"
                            />
                          ) : (
                            formatUGX(cls.lunchFee)
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {isEditing ? (
                            <input
                              type="number"
                              value={feeDraft.activityFee}
                              onChange={(e) => setFeeDraft({ ...feeDraft, activityFee: Number(e.target.value) })}
                              className="w-24 px-2 py-1 text-xs border border-slate-300 rounded text-right"
                            />
                          ) : (
                            formatUGX(cls.activityFee)
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatUGX(getClassTotalFee(cls))}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onUpdateClass(cls.id, feeDraft);
                                  setEditingClassId(null);
                                }}
                                className="text-xs font-medium text-emerald-700 hover:underline"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingClassId(null)}
                                className="text-xs text-slate-500 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClassId(cls.id);
                                setFeeDraft({
                                  tuitionFee: cls.tuitionFee,
                                  lunchFee: cls.lunchFee,
                                  activityFee: cls.activityFee,
                                });
                              }}
                              className="text-xs font-medium text-blue-700 hover:underline"
                            >
                              Edit Fees
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'attendance') {
    const classStudents = db.students.filter(
      (s) => s.enrollmentStatus === 'Active' && (classFilter === 'ALL' ? true : s.classId === classFilter)
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Attendance & Academic Term Marks</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Update termly attendance rates and assessment averages for admitted students.
            </p>
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg"
          >
            <option value="ALL">All Classes ({classStudents.length})</option>
            {db.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {classStudents.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No active students found. Admit students first in the Student Admissions module.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                    <th className="py-2.5 px-4">Student ID</th>
                    <th className="py-2.5 px-4">Student Name</th>
                    <th className="py-2.5 px-4">Class</th>
                    <th className="py-2.5 px-4 text-right">Attendance %</th>
                    <th className="py-2.5 px-4 text-right">Academic Average %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {classStudents.map((stu) => {
                    const cls = db.classes.find((c) => c.id === stu.classId);
                    return (
                      <tr key={stu.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{stu.admissionNo}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{stu.fullName}</td>
                        <td className="py-2.5 px-4 text-slate-700">{cls?.name || '—'}</td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            key={`${stu.id}-att-${stu.attendanceRate}`}
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={stu.attendanceRate}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (Number.isFinite(val) && val >= 0 && val <= 100 && val !== stu.attendanceRate) {
                                onUpdateStudent(stu.id, { attendanceRate: val });
                              }
                            }}
                            className="w-20 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded-md"
                          />
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <input
                            key={`${stu.id}-avg-${stu.academicAverage}`}
                            type="number"
                            min="0"
                            max="100"
                            defaultValue={stu.academicAverage}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (Number.isFinite(val) && val >= 0 && val <= 100 && val !== stu.academicAverage) {
                                onUpdateStudent(stu.id, { academicAverage: val });
                              }
                            }}
                            className="w-20 px-2 py-1 text-xs font-mono tabular-nums text-right border border-slate-300 rounded-md"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Admissions & Searchable Student Database (Default)
  const filtered = db.students.filter((stu) => {
    if (classFilter !== 'ALL' && stu.classId !== classFilter) return false;
    if (boardingFilter !== 'ALL' && stu.boardingStatus !== boardingFilter) return false;
    if (specialNeedsOnly && !stu.hasSpecialNeeds) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        stu.fullName.toLowerCase().includes(q) ||
        stu.admissionNo.toLowerCase().includes(q) ||
        stu.guardianName.toLowerCase().includes(q) ||
        stu.guardianPhone.toLowerCase().includes(q) ||
        stu.previousSchool.toLowerCase().includes(q) ||
        stu.specialNeedsDetails.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const specialNeedsCount = db.students.filter((s) => s.hasSpecialNeeds).length;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#1E3A8A] via-[#1D4ED8] to-[#0284C7] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Student Admissions &amp; Class Records
          </h2>
          <p className="text-xs sm:text-sm text-sky-100">
            Register new students with automatic IDs, set class fees in UGX, and track guardian details easily.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                'admitted-students.csv',
                [
                  'Student ID',
                  'Full Name',
                  'Class',
                  'Gender',
                  'Boarding',
                  'Guardian',
                  'Guardian Phone',
                  'Previous School',
                  'Prior Score',
                  'Special Needs',
                  'Special Needs Details',
                  'Status',
                ],
                filtered.map((s) => [
                  s.admissionNo,
                  s.fullName,
                  db.classes.find((c) => c.id === s.classId)?.name || '',
                  s.gender,
                  s.boardingStatus,
                  s.guardianName,
                  s.guardianPhone,
                  s.previousSchool,
                  s.previousAcademicScore,
                  s.hasSpecialNeeds ? 'Yes' : 'No',
                  s.specialNeedsDetails,
                  s.enrollmentStatus,
                ])
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export Registry CSV
          </button>
          <button
            type="button"
            onClick={onOpenAddClassModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Class
          </button>
          <button
            type="button"
            onClick={onOpenEnrollModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-300 hover:bg-amber-200 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register New Student
          </button>
        </div>
      </div>

      {/* Quick Actions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={onOpenEnrollModal}
          className="bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">1. Register a New Student</div>
            <div className="text-xs text-slate-500 truncate">Step-by-step form with automatic ID</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenAddClassModal}
          className="bg-white border border-slate-200/90 hover:border-teal-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-teal-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">2. Add Class &amp; Term Fees</div>
            <div className="text-xs text-slate-500 truncate">Set tuition, meals &amp; activity (UGX)</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('attendance')}
          className="bg-white border border-slate-200/90 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 rounded-xl p-4 flex items-center gap-3.5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">3. Attendance &amp; Exam Marks</div>
            <div className="text-xs text-slate-500 truncate">Enter student attendance &amp; marks</div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Admitted Students</div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-800 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-indigo-950 tabular-nums mt-1">
            {fin.studentSummaries.length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Active across {db.classes.length} classes</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Boarding / Day Split</div>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums mt-1">
            {db.students.filter((s) => s.boardingStatus === 'Boarding').length} /{' '}
            {db.students.filter((s) => s.boardingStatus === 'Day Scholar').length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Boarding · Day Scholars</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Special Needs Profiles</div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-amber-700 tabular-nums mt-1">
            {specialNeedsCount}
          </div>
          <div className="text-xs text-slate-500 mt-3">Medical or learning support flagged</div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-medium text-slate-500">Bursary Waivers</div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums mt-1">
            {formatUGX(db.students.reduce((s, st) => s + (st.feeDiscount || 0), 0))}
          </div>
          <div className="text-xs text-slate-500 mt-3">Termly fee discounts granted</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Student ID, name, guardian, previous school, or special needs..."
              className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="py-1.5 px-3 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">All Classes</option>
              {db.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={boardingFilter}
              onChange={(e) => setBoardingFilter(e.target.value as 'ALL' | 'Day Scholar' | 'Boarding')}
              className="py-1.5 px-3 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="ALL">Day & Boarding</option>
              <option value="Day Scholar">Day Scholar</option>
              <option value="Boarding">Boarding</option>
            </select>
            <button
              type="button"
              onClick={() => setSpecialNeedsOnly(!specialNeedsOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                specialNeedsOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Special Needs ({specialNeedsCount})
            </button>
          </div>
        </div>

        {db.students.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <UserPlus className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-medium text-slate-900">No students admitted yet</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {db.classes.length === 0
                ? 'Start by creating your school classes and UGX fee structures, then register your first student.'
                : 'Click "Admit New Student" to register a learner, assign a unique Student ID, and record guardian, academic, and special needs details.'}
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              {db.classes.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenAddClassModal}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  1. Create First Class
                </button>
              )}
              <button
                type="button"
                onClick={onOpenEnrollModal}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-xl hover:bg-blue-800"
              >
                Admit New Student
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No admitted students match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500 bg-slate-50/70">
                  <th className="py-2.5 px-4">Student ID</th>
                  <th className="py-2.5 px-4">Personal Details</th>
                  <th className="py-2.5 px-4">Class & Section</th>
                  <th className="py-2.5 px-4">Guardian Contact</th>
                  <th className="py-2.5 px-4">Prior Academic</th>
                  <th className="py-2.5 px-4">Special Needs</th>
                  <th className="py-2.5 px-4 text-right">Status & File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filtered.map((stu) => (
                  <tr key={stu.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-blue-700">
                      {stu.admissionNo}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{stu.fullName}</div>
                      <div className="text-xs text-slate-500">
                        {stu.gender} {stu.dateOfBirth ? `· DOB ${stu.dateOfBirth}` : ''} · Admitted {stu.admissionDate}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={stu.classId}
                        onChange={(e) => onUpdateStudent(stu.id, { classId: e.target.value })}
                        className="text-xs bg-white border border-slate-300 rounded px-2 py-1"
                      >
                        {db.classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-slate-500 mt-0.5">{stu.boardingStatus}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="text-xs font-medium text-slate-900">
                        {stu.guardianName} ({stu.guardianRelationship})
                      </div>
                      <div className="text-xs font-mono text-slate-500">{stu.guardianPhone}</div>
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      <div className="text-slate-900">{stu.previousSchool || '—'}</div>
                      <div className="text-slate-500 font-mono">{stu.previousAcademicScore || 'No prior score'}</div>
                    </td>
                    <td className="py-2.5 px-4 text-xs max-w-[180px]">
                      {stu.hasSpecialNeeds ? (
                        <div>
                          <div className="font-medium text-amber-800">Support Required</div>
                          <div className="text-slate-600 truncate">{stu.specialNeedsDetails}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <select
                          value={stu.enrollmentStatus}
                          onChange={(e) =>
                            onUpdateStudent(stu.id, { enrollmentStatus: e.target.value as EnrollmentStatus })
                          }
                          className={`text-xs font-medium bg-white border border-slate-300 rounded px-2 py-1 ${
                            stu.enrollmentStatus === 'Active' ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="Transferred">Transferred</option>
                          <option value="Suspended">Suspended</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => onOpenStudentDossier(stu)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Dossier
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
