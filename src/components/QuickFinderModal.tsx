import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  CheckSquare,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  Search,
  Settings,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { DashboardRole, SchoolDatabase, StaffMember, Student } from '../shared/types';
import { formatUGX } from '../utils/schoolFinance';

export interface QuickActionItem {
  id: string;
  title: string;
  subtitle: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  toneClass: string;
  onSelect: () => void;
}

export function QuickFinderModal({
  db,
  userRole,
  actions,
  onSelectStudent,
  onGoToStaff,
  onClose,
}: {
  db: SchoolDatabase;
  userRole: DashboardRole;
  actions: QuickActionItem[];
  onSelectStudent: (student: Student) => void;
  onGoToStaff: (staff: StaffMember) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const q = query.trim().toLowerCase();

  const matchingActions = useMemo(() => {
    if (!q) return actions.slice(0, 6);
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.keywords.toLowerCase().includes(q)
    );
  }, [actions, q]);

  const matchingStudents = useMemo(() => {
    if (!q) return db.students.slice(0, 4);
    return db.students
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          s.guardianName.toLowerCase().includes(q) ||
          s.guardianPhone.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [db.students, q]);

  const matchingStaff = useMemo(() => {
    if (userRole === 'registrar') return [];
    if (!q) return db.staff.slice(0, 3);
    return db.staff
      .filter(
        (st) =>
          st.fullName.toLowerCase().includes(q) ||
          st.employeeNo.toLowerCase().includes(q) ||
          st.roleTitle.toLowerCase().includes(q) ||
          st.category.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [db.staff, q, userRole]);

  const hasNothing = matchingActions.length === 0 && matchingStudents.length === 0 && matchingStaff.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/55 backdrop-blur-[2px] p-4 pt-12 sm:pt-20 no-print"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/60">
          <Search className="w-5 h-5 text-blue-700 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a student name, ID, staff member, or what you want to do..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
            aria-label="Close quick finder"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[68vh] overflow-y-auto divide-y divide-slate-100">
          {matchingActions.length > 0 && (
            <div className="p-3">
              <div className="px-2 pb-2 text-xs font-semibold text-slate-500">
                {q ? 'Matching Tasks & Pages' : 'What would you like to do?'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {matchingActions.map((act) => {
                  const Icon = act.icon;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        act.onSelect();
                        onClose();
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-blue-50/70 transition-colors group"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${act.toneClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 group-hover:text-blue-800 truncate">
                          {act.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{act.subtitle}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchingStudents.length > 0 && (
            <div className="p-3">
              <div className="px-2 pb-2 text-xs font-semibold text-slate-500">
                Students ({matchingStudents.length})
              </div>
              <div className="space-y-1">
                {matchingStudents.map((stu) => {
                  const cls = db.classes.find((c) => c.id === stu.classId);
                  return (
                    <button
                      key={stu.id}
                      type="button"
                      onClick={() => {
                        onSelectStudent(stu);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{stu.fullName}</div>
                          <div className="text-xs text-slate-500 truncate">
                            <span className="font-mono">{stu.admissionNo}</span> · {cls?.name || 'Unassigned'} · Guardian:{' '}
                            {stu.guardianName}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-blue-700 whitespace-nowrap shrink-0">Open File</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchingStaff.length > 0 && (
            <div className="p-3">
              <div className="px-2 pb-2 text-xs font-semibold text-slate-500">
                Teaching &amp; Support Staff ({matchingStaff.length})
              </div>
              <div className="space-y-1">
                {matchingStaff.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      onGoToStaff(st);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{st.fullName}</div>
                        <div className="text-xs text-slate-500 truncate">
                          {st.roleTitle} ({st.category}) · {st.employeeNo}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-700 shrink-0">
                      {formatUGX(st.baseSalary)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasNothing && (
            <div className="p-10 text-center text-sm text-slate-500">
              No matching students, staff, or actions found for &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Click any item to jump straight there</span>
          <span className="font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}

export {
  AlertTriangle,
  Banknote,
  BookOpen,
  CheckSquare,
  CreditCard,
  FileSpreadsheet,
  KeyRound,
  Settings,
  UserPlus,
  Wallet,
};
