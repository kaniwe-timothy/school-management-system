import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GraduationCap, HeartPulse, Users, Wallet, X } from 'lucide-react';
import type { BoardingStatus, SchoolClass } from '../shared/types';
import { formatUGX, getClassTotalFee } from '../utils/schoolFinance';

export interface AdmissionPayload {
  fullName: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  nationality: string;
  homeAddress: string;
  classId: string;
  boardingStatus: BoardingStatus;
  admissionDate: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  previousSchool: string;
  previousClass: string;
  previousAcademicScore: string;
  academicPerformanceNotes: string;
  hasSpecialNeeds: boolean;
  specialNeedsDetails: string;
  feeDiscount: number;
  notes: string;
}

const STEPS = [
  { id: 1, title: '1. Student Info', icon: Users },
  { id: 2, title: '2. Class & Fees', icon: Wallet },
  { id: 3, title: '3. Parent / Guardian', icon: Users },
  { id: 4, title: '4. Past School & Health', icon: HeartPulse },
] as const;

export function StudentAdmissionModal({
  classes,
  nextStudentIdHint,
  onSubmit,
  onOpenAddClass,
  onClose,
}: {
  classes: SchoolClass[];
  nextStudentIdHint: string;
  onSubmit: (payload: AdmissionPayload) => Promise<void>;
  onOpenAddClass: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Female');
  const [nationality, setNationality] = useState('Ugandan');
  const [homeAddress, setHomeAddress] = useState('');

  const [classId, setClassId] = useState(classes[0]?.id || '');
  const [boardingStatus, setBoardingStatus] = useState<BoardingStatus>('Day Scholar');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [feeDiscount, setFeeDiscount] = useState('0');

  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Parent');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  const [previousSchool, setPreviousSchool] = useState('');
  const [previousClass, setPreviousClass] = useState('');
  const [previousAcademicScore, setPreviousAcademicScore] = useState('');
  const [academicPerformanceNotes, setAcademicPerformanceNotes] = useState('');

  const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
  const [specialNeedsDetails, setSpecialNeedsDetails] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedClass = classes.find((c) => c.id === classId) || classes[0];
  const grossClassFee = selectedClass ? getClassTotalFee(selectedClass) : 0;
  const discountNum = Math.max(0, Number(feeDiscount) || 0);
  const netFeeToPay = Math.max(0, grossClassFee - discountNum);

  const goToNextStep = () => {
    setError('');
    if (step === 1 && !fullName.trim()) {
      setError('Please enter the student full name before continuing.');
      return;
    }
    if (step === 2 && !classId) {
      setError('Please select or create a class before continuing.');
      return;
    }
    if (step === 3 && (!guardianName.trim() || !guardianPhone.trim())) {
      setError('Please enter the parent or guardian name and phone number.');
      return;
    }
    if (step < 4) setStep((step + 1) as 1 | 2 | 3 | 4);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setStep(1);
      setError('Student full name is required.');
      return;
    }
    if (!classId) {
      setStep(2);
      setError('Please create or select a class first.');
      return;
    }
    if (!guardianName.trim() || !guardianPhone.trim()) {
      setStep(3);
      setError('Parent or guardian name and phone number are required.');
      return;
    }
    if (hasSpecialNeeds && !specialNeedsDetails.trim()) {
      setStep(4);
      setError('Please describe the special learning or medical needs.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        dateOfBirth,
        gender,
        nationality: nationality.trim() || 'Ugandan',
        homeAddress: homeAddress.trim(),
        classId,
        boardingStatus,
        admissionDate,
        guardianName: guardianName.trim(),
        guardianRelationship,
        guardianPhone: guardianPhone.trim(),
        guardianEmail: guardianEmail.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactPhone: emergencyContactPhone.trim(),
        previousSchool: previousSchool.trim(),
        previousClass: previousClass.trim(),
        previousAcademicScore: previousAcademicScore.trim(),
        academicPerformanceNotes: academicPerformanceNotes.trim(),
        hasSpecialNeeds,
        specialNeedsDetails: hasSpecialNeeds ? specialNeedsDetails.trim() : '',
        feeDiscount: discountNum,
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to admit student.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#0F1B4C] to-[#1E3A8A] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Register New Student</h3>
              <p className="text-xs text-blue-100 mt-0.5">
                Student ID <span className="font-mono font-semibold text-white">{nextStudentIdHint}</span> will be given automatically when you save.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Step Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STEPS.map((s) => {
            const isCurrent = step === s.id;
            const isDone = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setError('');
                  setStep(s.id as 1 | 2 | 3 | 4);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                  isCurrent
                    ? 'bg-blue-700 text-white shadow-sm'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {isDone ? <Check className="w-3.5 h-3.5 shrink-0" /> : null}
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {classes.length === 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-amber-900">
                Before registering a student, please add at least one class (like Primary 1 or Senior 1) and its term fee in UGX.
              </div>
              <button
                type="button"
                onClick={onOpenAddClass}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 whitespace-nowrap"
              >
                Add First Class Now
              </button>
            </div>
          )}

          {/* Step 1: Student Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Step 1: Student Personal Details</h4>
                <p className="text-xs text-slate-500 mt-0.5">Enter the child&apos;s full name and basic personal details.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Sarah Namukasa"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as 'Male' | 'Female')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="Female">Female (Girl)</option>
                    <option value="Male">Male (Boy)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Home Village / District</label>
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    placeholder="e.g., Wakiso / Entebbe"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Class & Fees */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Step 2: Class &amp; Term School Fees (UGX)</h4>
                <p className="text-xs text-slate-500 mt-0.5">Choose the student&apos;s class and see the exact fees to pay.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Select Class *</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
                    required
                  >
                    {classes.length === 0 ? (
                      <option value="">No classes added yet</option>
                    ) : (
                      classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.stream}) · {formatUGX(getClassTotalFee(c))}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Day or Boarding</label>
                  <select
                    value={boardingStatus}
                    onChange={(e) => setBoardingStatus(e.target.value as BoardingStatus)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Boarding">Boarding</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Discount / Bursary (UGX)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={feeDiscount}
                    onChange={(e) => setFeeDiscount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              {selectedClass && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-slate-600">Class Term Fee</div>
                    <div className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                      {formatUGX(grossClassFee)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-600">Bursary Discount</div>
                    <div className="font-mono font-semibold text-emerald-700 mt-0.5 tabular-nums">
                      -{formatUGX(discountNum)}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-blue-900 font-medium">Final Term Fees to Pay</div>
                    <div className="text-base font-mono font-bold text-blue-900 mt-0.5 tabular-nums">
                      {formatUGX(netFeeToPay)}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Admission Date</label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Office Notes (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any extra remark"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Parent / Guardian */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Step 3: Parent or Guardian Contact</h4>
                <p className="text-xs text-slate-500 mt-0.5">Who pays fees and who should the school call in an emergency?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Parent / Guardian Name *</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Relationship</label>
                  <select
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
                  >
                    <option value="Parent">Parent</option>
                    <option value="Mother">Mother</option>
                    <option value="Father">Father</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sponsor">Sponsor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="+256 7XX XXX XXX"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    placeholder="Optional email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Another relative"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Emergency Phone</label>
                  <input
                    type="text"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+256 7XX XXX XXX"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Past School & Health / Special Needs */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Step 4: Previous School &amp; Special Needs</h4>
                <p className="text-xs text-slate-500 mt-0.5">Record past academic grades and any medical or learning support needed.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Previous School</label>
                  <input
                    type="text"
                    value={previousSchool}
                    onChange={(e) => setPreviousSchool(e.target.value)}
                    placeholder="Former school name"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Class Attended</label>
                  <input
                    type="text"
                    value={previousClass}
                    onChange={(e) => setPreviousClass(e.target.value)}
                    placeholder="e.g., Primary 4"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Previous Score / Grade</label>
                  <input
                    type="text"
                    value={previousAcademicScore}
                    onChange={(e) => setPreviousAcademicScore(e.target.value)}
                    placeholder="e.g., Div 1 (Agg 7) or 82%"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Academic Performance Notes
                </label>
                <textarea
                  rows={2}
                  value={academicPerformanceNotes}
                  onChange={(e) => setAcademicPerformanceNotes(e.target.value)}
                  placeholder="Report card notes, strengths, or interview remarks..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-900">
                  <input
                    type="checkbox"
                    checked={hasSpecialNeeds}
                    onChange={(e) => setHasSpecialNeeds(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-700"
                  />
                  <span>This student has special medical, food allergy, or learning needs</span>
                </label>
                {hasSpecialNeeds && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Please Explain Special Needs / Medical Details *
                    </label>
                    <textarea
                      rows={2}
                      value={specialNeedsDetails}
                      onChange={(e) => setSpecialNeedsDetails(e.target.value)}
                      placeholder="e.g., Asthmatic (carries inhaler), peanut allergy, or needs front-row seating..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      required={hasSpecialNeeds}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep((step - 1) as 1 | 2 | 3 | 4);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step < 4 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 shadow-sm"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving || classes.length === 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving Student...' : `Save & Admit (${nextStudentIdHint})`}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
