import { useState } from 'react';
import { Shield } from 'lucide-react';
import type { DashboardRole } from '../shared/types';
import crestImg from '../assets/small/crest.webp';
import ownerImg from '../assets/small/owner.webp';
import headteacherImg from '../assets/small/headteacher.webp';
import bursarImg from '../assets/small/bursar.webp';
import registrarImg from '../assets/small/registrar.webp';

export const SCHOOL_CREST_SRC = crestImg;

export const ROLE_PROFILES: Record<
  DashboardRole,
  {
    roleLabel: string;
    shortTitle: string;
    officeTitle: string;
    avatarSrc: string;
    initials: string;
  }
> = {
  owner: {
    roleLabel: 'School Owner',
    shortTitle: 'Owner',
    officeTitle: 'Proprietor & Governance Desk',
    avatarSrc: ownerImg,
    initials: 'OW',
  },
  headteacher: {
    roleLabel: 'Head Teacher / Headmaster',
    shortTitle: 'Head Teacher',
    officeTitle: 'Academic & Staff Operations',
    avatarSrc: headteacherImg,
    initials: 'HT',
  },
  bursar: {
    roleLabel: 'School Bursar',
    shortTitle: 'Bursar',
    officeTitle: 'Fees, Payroll & Cashbook (UGX)',
    avatarSrc: bursarImg,
    initials: 'BR',
  },
  registrar: {
    roleLabel: 'Academic Registrar',
    shortTitle: 'Registrar',
    officeTitle: 'Student Admissions & Classes',
    avatarSrc: registrarImg,
    initials: 'AR',
  },
};

export function RoleAvatar({ role, size = 'md' }: { role: DashboardRole; size?: 'sm' | 'md' | 'lg' }) {
  const [errored, setErrored] = useState(false);
  const profile = ROLE_PROFILES[role];
  const dims = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-9 h-9 text-xs';

  if (errored) {
    return (
      <div
        className={`${dims} rounded-xl bg-blue-700 text-white font-semibold flex items-center justify-center shrink-0`}
        aria-label={profile.roleLabel}
      >
        {profile.initials}
      </div>
    );
  }

  return (
    <img
      src={profile.avatarSrc}
      alt={profile.roleLabel}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${dims} rounded-lg object-cover border border-white/20 shrink-0`}
    />
  );
}

export function SchoolCrest({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const [errored, setErrored] = useState(false);
  const dims = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (errored) {
    return (
      <div className={`${dims} rounded-xl bg-blue-800 text-white flex items-center justify-center shrink-0`}>
        <Shield className="w-4 h-4" />
      </div>
    );
  }

  return (
    <img
      src={SCHOOL_CREST_SRC}
      alt="School Crest"
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${dims} rounded-lg object-cover border border-slate-200 shrink-0 bg-white`}
    />
  );
}
