/**
 * In-browser replacement for the original Express + SQLite server.
 *
 * The app's components still call `fetch('/api/...')` exactly as before; this
 * module intercepts those calls and answers them from data saved in the
 * browser's localStorage. That lets the whole ledger run as one HTML file
 * (or a static GitHub Pages site) with no server at all.
 *
 * Data lives only on the device/browser that opened the page.
 */
import type {
  AuthUser,
  CampusNotice,
  DashboardRole,
  ExpenseApprovalStatus,
  ExpenseCategory,
  FeePayment,
  PaymentMethod,
  PayrollRecord,
  SchoolClass,
  SchoolDatabase,
  SchoolExpense,
  SchoolProfile,
  StaffCategory,
  StaffMember,
  Student,
} from './shared/types';

const STORAGE_KEY = 'crestwood-school-ledger:v1';

interface StoredUser extends AuthUser {
  passwordHash: string;
}
interface StoredSession {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}
interface Store {
  profile: SchoolProfile;
  classes: SchoolClass[];
  students: Student[];
  feePayments: FeePayment[];
  staff: StaffMember[];
  payroll: PayrollRecord[];
  expenses: SchoolExpense[];
  notices: CampusNotice[];
  users: StoredUser[];
  sessions: StoredSession[];
}

const DEFAULT_PROFILE: SchoolProfile = {
  schoolName: 'My School Management System',
  motto: 'Knowledge, Integrity & Service',
  address: 'Kampala, Uganda',
  phone: '',
  email: '',
  activeTerm: 'Term 3, 2026',
  activeMonth: '2026-11',
  feeDeadlineDate: '2026-12-05',
  approvalThresholdUgx: 500000,
};

function emptyStore(): Store {
  return {
    profile: { ...DEFAULT_PROFILE },
    classes: [],
    students: [],
    feePayments: [],
    staff: [],
    payroll: [],
    expenses: [],
    notices: [],
    users: [],
    sessions: [],
  };
}

// In-memory copy is the source of truth while the page is open; it survives
// even if localStorage is blocked (private mode), it just won't persist.
let memory: Store | null = null;

function load(): Store {
  if (memory) return memory;
  let loaded: Store = emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) loaded = { ...emptyStore(), ...(JSON.parse(raw) as Partial<Store>) };
  } catch {
    // storage unavailable or corrupt: start empty
  }
  memory = loaded;
  return loaded;
}

function save(store: Store): void {
  memory = store;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // storage full or blocked: keep working in memory
  }
}

// ---------- helpers ported from server.ts ----------

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['Cash', 'Bank Deposit', 'Mobile Money', 'Cheque'];
const VALID_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Utilities',
  'Food & Kitchen',
  'Teaching Supplies',
  'Maintenance',
  'Transport & Fuel',
  'Administration',
  'Capital & Equipment',
];
const VALID_STAFF_CATEGORIES: StaffCategory[] = ['Teaching', 'Non-Teaching'];
const VALID_ROLES: DashboardRole[] = ['owner', 'headteacher', 'bursar', 'registrar'];

function cleanString(val: unknown, maxLen = 250): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function cleanInt(val: unknown, allowZero = false): number | null {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  if (allowZero ? rounded < 0 : rounded <= 0) return null;
  return rounded;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateId(prefix: string): string {
  return `${prefix}_${randomHex(4)}`;
}

const today = () => new Date().toISOString().slice(0, 10);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function nextSequential(existing: Set<string>, start: number, make: (n: number) => string): string {
  let seq = start;
  while (existing.has(make(seq))) seq += 1;
  return make(seq);
}

// ---------- password hashing (pure JS SHA-256, works on file:// too) ----------

function sha256Hex(message: string): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLen >>> 0);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

const HASH_ROUNDS = 5000;
function derive(password: string, salt: string): string {
  let h = sha256Hex(`${salt}:${password}`);
  for (let i = 1; i < HASH_ROUNDS; i++) h = sha256Hex(`${salt}${h}${password}`);
  return h;
}
function hashPassword(password: string): string {
  const salt = randomHex(16);
  return `${salt}:${derive(password, salt)}`;
}
function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  return derive(password, salt) === key;
}

// ---------- read model (mirrors readFullDatabase ordering) ----------

function publicUser(u: StoredUser): AuthUser {
  const { passwordHash: _omit, ...rest } = u;
  return { ...rest };
}

function listUsers(s: Store): AuthUser[] {
  return [...s.users].sort((a, b) => cmp(a.createdAt, b.createdAt)).map(publicUser);
}

function readFull(s: Store): SchoolDatabase {
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
  return clone({
    profile: s.profile,
    classes: [...s.classes].sort((a, b) => cmp(a.name, b.name)),
    students: [...s.students].sort(
      (a, b) => cmp(b.admissionDate, a.admissionDate) || cmp(b.admissionNo, a.admissionNo)
    ),
    feePayments: [...s.feePayments].sort(
      (a, b) => cmp(b.paymentDate, a.paymentDate) || cmp(b.receiptNo, a.receiptNo)
    ),
    staff: [...s.staff].sort((a, b) => cmp(a.employeeNo, b.employeeNo)),
    payroll: [...s.payroll].sort((a, b) => cmp(b.month, a.month) || cmp(a.voucherNo, b.voucherNo)),
    expenses: [...s.expenses].sort((a, b) => cmp(b.date, a.date) || cmp(b.voucherNo, a.voucherNo)),
    notices: [...s.notices].sort((a, b) => cmp(b.date, a.date)),
    lastUpdated: new Date().toISOString(),
  });
}

// ---------- sessions ----------

function createSession(s: Store, userId: string): string {
  const token = randomHex(32);
  const now = new Date();
  s.sessions = s.sessions.filter((x) => x.expiresAt > now.toISOString());
  s.sessions.push({
    tokenHash: sha256Hex(token),
    userId,
    expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
  });
  const user = s.users.find((u) => u.id === userId);
  if (user) user.lastLoginAt = now.toISOString();
  return token;
}

function userFromToken(s: Store, token: string): StoredUser | null {
  if (!token) return null;
  const hash = sha256Hex(token);
  const nowIso = new Date().toISOString();
  const sess = s.sessions.find((x) => x.tokenHash === hash && x.expiresAt > nowIso);
  if (!sess) return null;
  const user = s.users.find((u) => u.id === sess.userId && u.isActive);
  return user ?? null;
}

function createUser(
  s: Store,
  input: { username: string; fullName: string; role: DashboardRole; password: string }
): StoredUser {
  const user: StoredUser = {
    id: generateId('usr'),
    username: input.username.trim(),
    fullName: input.fullName.trim(),
    role: input.role,
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    passwordHash: hashPassword(input.password),
  };
  s.users.push(user);
  return user;
}

// ---------- routing ----------

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Ctx {
  method: string;
  path: string;
  query: URLSearchParams;
  body: Record<string, any>;
  token: string;
  store: Store;
  user: StoredUser | null;
}

type Result = { status?: number; json: unknown };

function requireUser(ctx: Ctx, ...roles: DashboardRole[]): StoredUser {
  if (!ctx.token) throw new HttpError(401, 'Authentication required. Please sign in.');
  if (!ctx.user) throw new HttpError(401, 'Session expired or invalid. Please sign in again.');
  if (roles.length > 0 && !roles.includes(ctx.user.role)) {
    throw new HttpError(403, 'Your role does not have permission for this action.');
  }
  return ctx.user;
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function route(ctx: Ctx): Result {
  const { method, path, body, store: s } = ctx;
  const seg = path.replace(/^\/api\//, '').split('/').map(decodeURIComponent);
  // Every "/:id" route in the original server is a PATCH on one of these collections.
  const isIdRoute =
    method === 'PATCH' && seg.length === 2 && ['users', 'classes', 'students', 'staff', 'expenses'].includes(seg[0]);
  const key = `${method} ${seg[0]}${seg.length > 1 ? '/' + (isIdRoute ? ':id' : seg[1]) : ''}`;
  const id = seg[1];

  switch (key) {
    // ----- auth -----
    case 'GET auth/status':
      return { json: { requiresInitialSetup: s.users.length === 0, schoolName: s.profile.schoolName } };

    case 'POST auth/setup': {
      const cleanName = cleanString(body.fullName, 120);
      const cleanUser = cleanString(body.username, 80);
      const rawPass = typeof body.password === 'string' ? body.password : '';
      if (!cleanName || !cleanUser) throw new HttpError(400, 'Owner name and username are required.');
      if (rawPass.length < 6) throw new HttpError(400, 'Password must be at least 6 characters long.');
      if (s.users.length > 0) throw new HttpError(403, 'Initial School Owner account has already been configured.');
      const user = createUser(s, { username: cleanUser, fullName: cleanName, role: 'owner', password: rawPass });
      const token = createSession(s, user.id);
      save(s);
      return { status: 201, json: { token, user: publicUser(user) } };
    }

    case 'POST auth/login': {
      const cleanUser = cleanString(body.username, 80);
      const rawPass = typeof body.password === 'string' ? body.password : '';
      const rateKey = cleanUser.toLowerCase();
      const now = Date.now();
      const entry = loginAttempts.get(rateKey);
      if (!entry || entry.resetAt <= now) loginAttempts.set(rateKey, { count: 1, resetAt: now + 600000 });
      else if (entry.count >= 20) throw new HttpError(429, 'Too many sign-in attempts. Please wait a few minutes and try again.');
      else entry.count += 1;

      if (!cleanUser || !rawPass) throw new HttpError(400, 'Username and password are required.');
      const user = s.users.find((u) => u.username.toLowerCase() === cleanUser.toLowerCase());
      if (!user || !user.isActive || !verifyPassword(rawPass, user.passwordHash)) {
        throw new HttpError(401, 'Invalid username or password, or account is disabled.');
      }
      loginAttempts.delete(rateKey);
      const token = createSession(s, user.id);
      save(s);
      return { json: { token, user: publicUser(user) } };
    }

    case 'POST auth/logout': {
      requireUser(ctx);
      const hash = sha256Hex(ctx.token);
      s.sessions = s.sessions.filter((x) => x.tokenHash !== hash);
      save(s);
      return { json: { ok: true } };
    }

    case 'GET auth/me':
      return { json: { user: publicUser(requireUser(ctx)) } };

    case 'POST auth/password': {
      const me = requireUser(ctx);
      const curr = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const next = typeof body.newPassword === 'string' ? body.newPassword : '';
      if (!curr || next.length < 6) {
        throw new HttpError(400, 'Current password and a new password (min 6 characters) are required.');
      }
      if (!verifyPassword(curr, me.passwordHash)) throw new HttpError(400, 'Current password is incorrect.');
      me.passwordHash = hashPassword(next);
      save(s);
      return { json: { ok: true } };
    }

    // ----- users -----
    case 'GET users':
      requireUser(ctx, 'owner');
      return { json: { users: listUsers(s) } };

    case 'POST users': {
      requireUser(ctx, 'owner');
      const cleanUser = cleanString(body.username, 80);
      const cleanName = cleanString(body.fullName, 120);
      const rawPass = typeof body.password === 'string' ? body.password : '';
      if (!cleanName || !cleanUser) throw new HttpError(400, 'Full name and username are required.');
      if (!VALID_ROLES.includes(body.role)) throw new HttpError(400, 'Valid staff role is required.');
      if (rawPass.length < 6) throw new HttpError(400, 'Initial password must be at least 6 characters long.');
      if (s.users.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
        throw new HttpError(400, `Username "${cleanUser}" is already taken.`);
      }
      const user = createUser(s, { username: cleanUser, fullName: cleanName, role: body.role, password: rawPass });
      save(s);
      return { status: 201, json: { user: publicUser(user), users: listUsers(s) } };
    }

    case 'PATCH users/:id': {
      const me = requireUser(ctx, 'owner');
      const { fullName, role, isActive, password } = body;
      if (id === me.id && isActive === false) throw new HttpError(400, 'You cannot disable your own active Owner account.');
      if (id === me.id && role && role !== 'owner') throw new HttpError(400, 'You cannot downgrade your own active Owner role.');
      if (role !== undefined && !VALID_ROLES.includes(role)) throw new HttpError(400, 'Invalid role specified.');
      if (password !== undefined && (typeof password !== 'string' || password.length < 6)) {
        throw new HttpError(400, 'Reset password must be at least 6 characters long.');
      }
      const target = s.users.find((u) => u.id === id);
      if (!target) throw new HttpError(404, 'User account not found.');
      const nextName = fullName !== undefined ? cleanString(fullName, 120) : '';
      if (nextName) target.fullName = nextName;
      if (role) target.role = role;
      if (typeof isActive === 'boolean') target.isActive = isActive;
      if (typeof password === 'string' && password.length >= 6) target.passwordHash = hashPassword(password);
      if (!target.isActive || typeof password === 'string') {
        s.sessions = s.sessions.filter((x) => x.userId !== target.id);
      }
      save(s);
      return { json: { user: publicUser(target), users: listUsers(s) } };
    }

    // ----- school -----
    case 'GET school':
      requireUser(ctx);
      return { json: readFull(s) };

    case 'PATCH school/profile': {
      requireUser(ctx, 'owner');
      const cur = s.profile;
      s.profile = {
        schoolName: cleanString(body.schoolName, 120) || cur.schoolName,
        motto: cleanString(body.motto, 160) || cur.motto,
        address: cleanString(body.address, 160) || cur.address,
        phone: body.phone !== undefined ? cleanString(body.phone, 50) : cur.phone,
        email: body.email !== undefined ? cleanString(body.email, 120) : cur.email,
        activeTerm: cleanString(body.activeTerm, 50) || cur.activeTerm,
        activeMonth: cleanString(body.activeMonth, 20) || cur.activeMonth,
        feeDeadlineDate: cleanString(body.feeDeadlineDate, 20) || cur.feeDeadlineDate,
        approvalThresholdUgx:
          body.approvalThresholdUgx !== undefined
            ? cleanInt(body.approvalThresholdUgx, false) ?? cur.approvalThresholdUgx
            : cur.approvalThresholdUgx,
      };
      save(s);
      return { json: readFull(s) };
    }

    case 'POST school/clear':
      requireUser(ctx, 'owner');
      clearRecords(s);
      save(s);
      return { json: readFull(s) };

    case 'POST school/restore': {
      requireUser(ctx, 'owner');
      const p = body as SchoolDatabase;
      if (!p || !p.profile || !Array.isArray(p.classes) || !Array.isArray(p.students)) {
        throw new HttpError(400, 'Invalid backup file format.');
      }
      clearRecords(s);
      s.profile = {
        schoolName: p.profile.schoolName || 'My School',
        motto: p.profile.motto || '',
        address: p.profile.address || '',
        phone: p.profile.phone || '',
        email: p.profile.email || '',
        activeTerm: p.profile.activeTerm || 'Term 1, 2026',
        activeMonth: p.profile.activeMonth || '2026-11',
        feeDeadlineDate: p.profile.feeDeadlineDate || '2026-12-05',
        approvalThresholdUgx: Number(p.profile.approvalThresholdUgx) || 500000,
      };
      s.staff = (p.staff || []).map((x) => ({ ...x, performanceNote: x.performanceNote || '' }));
      s.classes = (p.classes || []).map((x) => ({ ...x, classTeacherId: x.classTeacherId || '' }));
      s.students = (p.students || []).map((x) => ({ ...x, hasSpecialNeeds: Boolean(x.hasSpecialNeeds) }));
      s.feePayments = [...(p.feePayments || [])];
      s.payroll = [...(p.payroll || [])];
      s.expenses = [...(p.expenses || [])];
      s.notices = [...(p.notices || [])];
      save(s);
      return { json: readFull(s) };
    }

    // ----- classes -----
    case 'POST classes': {
      requireUser(ctx, 'owner', 'registrar', 'headteacher');
      const name = cleanString(body.name, 50);
      if (!name) throw new HttpError(400, 'Class name is required (e.g., Primary 1 or Senior 1).');
      if (s.classes.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        throw new HttpError(400, `Class "${name}" already exists.`);
      }
      const tuition = cleanInt(body.tuitionFee, true);
      if (tuition === null) throw new HttpError(400, 'Valid tuition fee in UGX is required.');
      s.classes.push({
        id: generateId('cls'),
        name,
        stream: cleanString(body.stream, 40) || 'Main',
        room: cleanString(body.room, 60) || 'Main Block',
        capacity: cleanInt(body.capacity ?? 40, false) ?? 40,
        classTeacherId: cleanString(body.classTeacherId, 60),
        tuitionFee: tuition,
        lunchFee: cleanInt(body.lunchFee ?? 0, true) ?? 0,
        activityFee: cleanInt(body.activityFee ?? 0, true) ?? 0,
      });
      save(s);
      return { status: 201, json: readFull(s) };
    }

    case 'PATCH classes/:id': {
      requireUser(ctx, 'owner', 'registrar', 'headteacher');
      const c = s.classes.find((x) => x.id === id);
      if (!c) throw new HttpError(404, 'Class not found.');
      const t = body.tuitionFee !== undefined ? cleanInt(body.tuitionFee, true) : c.tuitionFee;
      const l = body.lunchFee !== undefined ? cleanInt(body.lunchFee, true) : c.lunchFee;
      const a = body.activityFee !== undefined ? cleanInt(body.activityFee, true) : c.activityFee;
      const cap = body.capacity !== undefined ? cleanInt(body.capacity, false) : c.capacity;
      if (t === null || l === null || a === null || cap === null) {
        throw new HttpError(400, 'Invalid numeric value for class fees or capacity.');
      }
      if (body.name !== undefined) c.name = cleanString(body.name, 50) || c.name;
      if (body.stream !== undefined) c.stream = cleanString(body.stream, 40) || c.stream;
      if (body.room !== undefined) c.room = cleanString(body.room, 60) || c.room;
      if (body.classTeacherId !== undefined) c.classTeacherId = cleanString(body.classTeacherId, 60);
      Object.assign(c, { tuitionFee: t, lunchFee: l, activityFee: a, capacity: cap });
      save(s);
      return { json: readFull(s) };
    }

    // ----- students -----
    case 'GET students/search': {
      requireUser(ctx);
      const q = cleanString(ctx.query.get('q'), 100).toLowerCase();
      const classId = cleanString(ctx.query.get('classId'), 60);
      const specialOnly = ctx.query.get('specialNeeds') === 'true';
      const rows = readFull(s).students.filter((st) => {
        if (q) {
          const hay = [st.fullName, st.admissionNo, st.guardianName, st.guardianPhone, st.previousSchool, st.specialNeedsDetails];
          if (!hay.some((h) => (h || '').toLowerCase().includes(q))) return false;
        }
        if (classId && classId !== 'ALL' && st.classId !== classId) return false;
        if (specialOnly && !st.hasSpecialNeeds) return false;
        return true;
      });
      return { json: { count: rows.length, students: rows } };
    }

    case 'POST students': {
      requireUser(ctx, 'owner', 'registrar', 'headteacher');
      const fullName = cleanString(body.fullName, 120);
      const guardianName = cleanString(body.guardianName, 120);
      const guardianPhone = cleanString(body.guardianPhone, 50);
      if (!fullName || !guardianName || !guardianPhone) {
        throw new HttpError(400, 'Student full name, guardian name, and guardian phone are required.');
      }
      const classId = cleanString(body.classId, 60);
      if (!s.classes.some((c) => c.id === classId)) {
        throw new HttpError(400, 'Please select a valid class before admitting a student.');
      }
      const year = new Date().getFullYear();
      const admissionNo = nextSequential(
        new Set(s.students.map((x) => x.admissionNo)),
        s.students.length + 1,
        (n) => `STU-${year}-${String(n).padStart(4, '0')}`
      );
      const student: Student = {
        id: generateId('stu'),
        admissionNo,
        fullName,
        dateOfBirth: cleanString(body.dateOfBirth, 20),
        gender: body.gender === 'Male' ? 'Male' : 'Female',
        nationality: cleanString(body.nationality, 60) || 'Ugandan',
        homeAddress: cleanString(body.homeAddress, 180),
        classId,
        boardingStatus: body.boardingStatus === 'Boarding' ? 'Boarding' : 'Day Scholar',
        enrollmentStatus: 'Active',
        admissionDate: cleanString(body.admissionDate, 20) || today(),
        guardianName,
        guardianRelationship: cleanString(body.guardianRelationship, 40) || 'Parent',
        guardianPhone,
        guardianEmail: cleanString(body.guardianEmail, 120),
        emergencyContactName: cleanString(body.emergencyContactName, 120),
        emergencyContactPhone: cleanString(body.emergencyContactPhone, 50),
        previousSchool: cleanString(body.previousSchool, 140),
        previousClass: cleanString(body.previousClass, 60),
        previousAcademicScore: cleanString(body.previousAcademicScore, 80),
        academicPerformanceNotes: cleanString(body.academicPerformanceNotes, 400),
        hasSpecialNeeds: Boolean(body.hasSpecialNeeds),
        specialNeedsDetails: cleanString(body.specialNeedsDetails, 400),
        attendanceRate: 100,
        academicAverage: 0,
        feeDiscount: cleanInt(body.feeDiscount ?? 0, true) ?? 0,
        notes: cleanString(body.notes, 300),
      };
      s.students.push(student);
      save(s);
      const full = readFull(s);
      return { status: 201, json: { student: full.students.find((x) => x.id === student.id), db: full } };
    }

    case 'PATCH students/:id': {
      requireUser(ctx, 'owner', 'registrar', 'headteacher');
      const st = s.students.find((x) => x.id === id);
      if (!st) throw new HttpError(404, 'Student not found.');
      const b = body;
      if (b.classId !== undefined) {
        const cid = cleanString(b.classId, 60);
        if (s.classes.some((c) => c.id === cid)) st.classId = cid;
      }
      if (b.attendanceRate !== undefined) {
        st.attendanceRate = Math.min(100, Math.max(0, cleanInt(b.attendanceRate, true) ?? st.attendanceRate));
      }
      if (b.academicAverage !== undefined) {
        st.academicAverage = Math.min(100, Math.max(0, cleanInt(b.academicAverage, true) ?? st.academicAverage));
      }
      if (b.feeDiscount !== undefined) st.feeDiscount = cleanInt(b.feeDiscount, true) ?? st.feeDiscount;
      if (['Active', 'Transferred', 'Suspended'].includes(b.enrollmentStatus)) st.enrollmentStatus = b.enrollmentStatus;
      if (b.boardingStatus === 'Day Scholar' || b.boardingStatus === 'Boarding') st.boardingStatus = b.boardingStatus;
      if (b.hasSpecialNeeds !== undefined) st.hasSpecialNeeds = Boolean(b.hasSpecialNeeds);
      if (b.gender === 'Male' || b.gender === 'Female') st.gender = b.gender;

      const required: Array<[keyof Student, number]> = [['fullName', 120], ['guardianName', 120], ['guardianPhone', 50]];
      for (const [k, max] of required) {
        if (b[k] !== undefined) (st as any)[k] = cleanString(b[k], max) || st[k];
      }
      const optional: Array<[keyof Student, number]> = [
        ['dateOfBirth', 20], ['nationality', 60], ['homeAddress', 180], ['guardianRelationship', 40],
        ['guardianEmail', 120], ['emergencyContactName', 120], ['emergencyContactPhone', 50],
        ['previousSchool', 140], ['previousClass', 60], ['previousAcademicScore', 80],
        ['academicPerformanceNotes', 400], ['specialNeedsDetails', 400], ['notes', 300],
      ];
      for (const [k, max] of optional) {
        if (b[k] !== undefined) (st as any)[k] = cleanString(b[k], max);
      }
      save(s);
      return { json: readFull(s) };
    }

    // ----- payments -----
    case 'POST payments': {
      const me = requireUser(ctx, 'owner', 'bursar');
      const studentId = cleanString(body.studentId, 60);
      if (!s.students.some((x) => x.id === studentId)) throw new HttpError(404, 'Student not found.');
      const amount = cleanInt(body.amount, false);
      if (amount === null) throw new HttpError(400, 'Payment amount in UGX must be greater than zero.');
      const yearShort = String(new Date().getFullYear()).slice(-2);
      const receiptNo = nextSequential(
        new Set(s.feePayments.map((x) => x.receiptNo)),
        s.feePayments.length + 1,
        (n) => `RCT-${yearShort}-${String(n).padStart(4, '0')}`
      );
      const payment: FeePayment = {
        id: generateId('pay'),
        receiptNo,
        studentId,
        term: cleanString(body.term, 40) || s.profile.activeTerm,
        amount,
        paymentDate: cleanString(body.paymentDate, 20) || today(),
        method: VALID_PAYMENT_METHODS.includes(body.method) ? body.method : 'Cash',
        recordedBy: cleanString(body.recordedBy, 100) || me.fullName || 'School Bursar',
        notes: cleanString(body.notes, 240),
      };
      s.feePayments.push(payment);
      save(s);
      const full = readFull(s);
      return { status: 201, json: { payment: full.feePayments.find((x) => x.id === payment.id), db: full } };
    }

    case 'GET payments/verify': {
      requireUser(ctx, 'owner', 'bursar');
      const receiptNoRaw = cleanString(ctx.query.get('receiptNo'), 80);
      const sidRaw = cleanString(ctx.query.get('sid'), 60);
      const amtStr = ctx.query.get('amt');
      const amtRaw = amtStr && amtStr.trim() !== '' ? Number(amtStr) : null;
      if (!receiptNoRaw) throw new HttpError(400, 'Receipt number is required for verification.');

      const full = readFull(s);
      const norm = receiptNoRaw.toLowerCase();
      const payment = full.feePayments.find((p) => p.receiptNo.toLowerCase() === norm || p.id.toLowerCase() === norm);
      if (!payment) {
        return { json: { verified: false, integrityMatch: false, message: `Receipt "${receiptNoRaw}" was not found in the school fee ledger.` } };
      }
      const student = full.students.find((x) => x.id === payment.studentId);
      if (!student) {
        return { json: { verified: false, integrityMatch: false, message: `Receipt "${payment.receiptNo}" exists, but its student profile could not be matched.` } };
      }
      const cls = full.classes.find((c) => c.id === student.classId) || null;
      const gross = cls ? cls.tuitionFee + cls.lunchFee + cls.activityFee : 0;
      const discount = Math.max(0, Math.min(gross, student.feeDiscount || 0));
      const netBilled = Math.max(0, gross - discount);
      const studentPayments = full.feePayments.filter((p) => p.studentId === student.id);
      const totalPaid = studentPayments
        .filter((p) => !p.term || p.term === full.profile.activeTerm)
        .reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(0, netBilled - totalPaid);
      const percentPaid = netBilled > 0 ? Math.min(100, Math.round((totalPaid / netBilled) * 100)) : 100;
      const feeStatus = balance === 0 ? 'Paid in Full' : percentPaid >= 60 ? 'Partial' : 'Defaulter';
      const reasons: string[] = [];
      if (sidRaw && sidRaw.toLowerCase() !== student.admissionNo.toLowerCase()) {
        reasons.push(`QR student ID (${sidRaw}) does not match ledger student ID (${student.admissionNo}).`);
      }
      if (amtRaw !== null && Number.isFinite(amtRaw) && Math.round(amtRaw) !== payment.amount) {
        reasons.push(
          `QR receipt amount (${Math.round(amtRaw).toLocaleString()} UGX) differs from ledger amount (${payment.amount.toLocaleString()} UGX).`
        );
      }
      return {
        json: {
          verified: true,
          integrityMatch: reasons.length === 0,
          mismatchReason: reasons.length > 0 ? reasons.join(' ') : undefined,
          payment,
          student,
          className: cls?.name || 'Unassigned',
          activeTerm: full.profile.activeTerm,
          termSummary: { netBilled, totalPaid, balance, percentPaid, feeStatus },
          studentPayments,
        },
      };
    }

    // ----- staff & payroll -----
    case 'POST staff': {
      requireUser(ctx, 'owner', 'bursar', 'headteacher');
      const fullName = cleanString(body.fullName, 120);
      const roleTitle = cleanString(body.roleTitle, 100);
      if (!fullName || !roleTitle) throw new HttpError(400, 'Staff full name and role title are required.');
      const category: StaffCategory = VALID_STAFF_CATEGORIES.includes(body.category) ? body.category : 'Teaching';
      const base = cleanInt(body.baseSalary, false);
      if (base === null) throw new HttpError(400, 'Base salary in UGX must be greater than zero.');
      const housing = cleanInt(body.housingAllowance ?? 0, true) ?? 0;
      const transport = cleanInt(body.transportAllowance ?? 0, true) ?? 0;
      const tax = cleanInt(body.taxDeduction ?? 0, true) ?? 0;
      const pension = cleanInt(body.pensionDeduction ?? 0, true) ?? 0;
      const employeeNo = nextSequential(new Set(s.staff.map((x) => x.employeeNo)), s.staff.length + 101, (n) => `EMP-${n}`);
      const member: StaffMember = {
        id: generateId('stf'),
        employeeNo,
        fullName,
        category,
        roleTitle,
        department: cleanString(body.department, 80) || (category === 'Teaching' ? 'Academics' : 'Operations'),
        assignedClassesOrArea: cleanString(body.assignedClassesOrArea, 120) || 'Campus General',
        phone: cleanString(body.phone, 50),
        bankAccount: cleanString(body.bankAccount, 100) || 'Cash Payroll',
        baseSalary: base,
        housingAllowance: housing,
        transportAllowance: transport,
        taxDeduction: tax,
        pensionDeduction: pension,
        attendanceRate: 100,
        status: 'Active',
        hireDate: today(),
        performanceNote: '',
      };
      s.staff.push(member);
      const month = s.profile.activeMonth;
      s.payroll.push(payrollFor(member, month, 'Bank Transfer'));
      save(s);
      const full = readFull(s);
      return { status: 201, json: { staffMember: full.staff.find((x) => x.id === member.id), db: full } };
    }

    case 'PATCH staff/:id': {
      const me = requireUser(ctx, 'owner', 'bursar', 'headteacher');
      const m = s.staff.find((x) => x.id === id);
      if (!m) throw new HttpError(404, 'Staff member not found.');
      const b = body;
      const touchesPay = ['baseSalary', 'housingAllowance', 'transportAllowance', 'taxDeduction', 'pensionDeduction'].some(
        (k) => b[k] !== undefined
      );
      if (touchesPay && me.role !== 'owner' && me.role !== 'bursar') {
        throw new HttpError(403, 'Only the School Owner or Bursar can adjust staff compensation.');
      }
      const base = b.baseSalary !== undefined ? cleanInt(b.baseSalary, false) : m.baseSalary;
      if (base === null) throw new HttpError(400, 'Invalid base salary.');
      m.baseSalary = base;
      if (b.housingAllowance !== undefined) m.housingAllowance = cleanInt(b.housingAllowance, true) ?? m.housingAllowance;
      if (b.transportAllowance !== undefined) m.transportAllowance = cleanInt(b.transportAllowance, true) ?? m.transportAllowance;
      if (b.taxDeduction !== undefined) m.taxDeduction = cleanInt(b.taxDeduction, true) ?? m.taxDeduction;
      if (b.pensionDeduction !== undefined) m.pensionDeduction = cleanInt(b.pensionDeduction, true) ?? m.pensionDeduction;
      if (b.status === 'On Leave' || b.status === 'Active') m.status = b.status;
      if (b.assignedClassesOrArea !== undefined) m.assignedClassesOrArea = cleanString(b.assignedClassesOrArea, 120);
      if (b.performanceNote !== undefined) m.performanceNote = cleanString(b.performanceNote, 300);

      const fresh = payrollFor(m, s.profile.activeMonth, 'Bank Transfer');
      for (const pr of s.payroll) {
        if (pr.staffId === m.id && pr.month === s.profile.activeMonth && pr.status === 'Pending') {
          Object.assign(pr, { baseSalary: fresh.baseSalary, allowances: fresh.allowances, deductions: fresh.deductions, netPay: fresh.netPay });
        }
      }
      save(s);
      return { json: readFull(s) };
    }

    case 'POST payroll/pay': {
      requireUser(ctx, 'owner', 'bursar');
      const month = cleanString(body.month, 10) || s.profile.activeMonth;
      const method = body.paymentMethod === 'Cash' || body.paymentMethod === 'Mobile Money' ? body.paymentMethod : 'Bank Transfer';
      for (const m of s.staff) {
        if (!s.payroll.some((pr) => pr.staffId === m.id && pr.month === month)) {
          s.payroll.push(payrollFor(m, month, method));
        }
      }
      const staffId = cleanString(body.staffId, 60);
      const category = VALID_STAFF_CATEGORIES.includes(body.category) ? (body.category as StaffCategory) : null;
      const inCategory = (sid: string) => s.staff.some((m) => m.id === sid && m.category === category);
      let updatedCount = 0;
      for (const pr of s.payroll) {
        if (pr.month !== month || pr.status !== 'Pending') continue;
        if (staffId ? pr.staffId !== staffId : category ? !inCategory(pr.staffId) : false) continue;
        pr.status = 'Paid';
        pr.paidDate = today();
        pr.paymentMethod = method;
        updatedCount += 1;
      }
      save(s);
      return { json: { updatedCount, db: readFull(s) } };
    }

    // ----- expenses -----
    case 'POST expenses': {
      requireUser(ctx, 'owner', 'bursar', 'headteacher');
      if (!VALID_EXPENSE_CATEGORIES.includes(body.category)) throw new HttpError(400, 'Valid expense category is required.');
      const description = cleanString(body.description, 240);
      const vendor = cleanString(body.vendor, 120);
      const amount = cleanInt(body.amount, false);
      if (!description || !vendor || amount === null) {
        throw new HttpError(400, 'Vendor, description, and positive UGX amount are required.');
      }
      const needsApproval = Boolean(body.requiresOwnerApproval) || amount >= s.profile.approvalThresholdUgx;
      const yearShort = String(new Date().getFullYear()).slice(-2);
      const voucherNo = nextSequential(
        new Set(s.expenses.map((x) => x.voucherNo)),
        s.expenses.length + 1,
        (n) => `EXP-${yearShort}-${String(n).padStart(4, '0')}`
      );
      const expense: SchoolExpense = {
        id: generateId('exp'),
        voucherNo,
        date: cleanString(body.date, 20) || today(),
        category: body.category,
        description,
        vendor,
        amount,
        paymentMethod:
          body.paymentMethod === 'Bank Transfer' || VALID_PAYMENT_METHODS.includes(body.paymentMethod) ? body.paymentMethod : 'Cash',
        requestedBy: cleanString(body.requestedBy, 100) || 'School Bursar',
        approvalStatus: needsApproval ? 'Pending Owner Approval' : 'Approved',
        paidStatus: needsApproval ? 'Unpaid' : 'Paid',
        notes: cleanString(body.notes, 240),
      };
      s.expenses.push(expense);
      save(s);
      const full = readFull(s);
      return { status: 201, json: { expense: full.expenses.find((x) => x.id === expense.id), db: full } };
    }

    case 'PATCH expenses/:id': {
      requireUser(ctx, 'owner');
      const e = s.expenses.find((x) => x.id === id);
      if (!e) throw new HttpError(404, 'Expense not found.');
      const valid: ExpenseApprovalStatus[] = ['Approved', 'Pending Owner Approval', 'Rejected'];
      if (body.approvalStatus && valid.includes(body.approvalStatus)) {
        e.approvalStatus = body.approvalStatus;
        e.paidStatus =
          body.paidStatus === 'Paid' || body.paidStatus === 'Unpaid'
            ? body.paidStatus
            : body.approvalStatus === 'Approved'
            ? 'Paid'
            : 'Unpaid';
      } else if (body.paidStatus === 'Paid' || body.paidStatus === 'Unpaid') {
        e.paidStatus = body.paidStatus;
      }
      save(s);
      return { json: readFull(s) };
    }

    // ----- notices -----
    case 'POST notices': {
      const me = requireUser(ctx, 'owner', 'headteacher');
      const title = cleanString(body.title, 140);
      const text = cleanString(body.body, 600);
      if (!title || !text) throw new HttpError(400, 'Notice title and message body are required.');
      s.notices.push({
        id: generateId('not'),
        title,
        audience: ['Teaching Staff', 'Parents & Guardians', 'Leadership'].includes(body.audience) ? body.audience : 'All Staff',
        date: today(),
        author: cleanString(body.author, 100) || me.fullName || 'Head Teacher',
        body: text,
        priority: body.priority === 'Urgent' ? 'Urgent' : 'Standard',
      });
      save(s);
      return { status: 201, json: { db: readFull(s) } };
    }
  }

  throw new HttpError(404, `Unknown endpoint: ${method} ${path}`);
}

function payrollFor(m: StaffMember, month: string, method: PayrollRecord['paymentMethod']): PayrollRecord {
  const allowances = m.housingAllowance + m.transportAllowance;
  const deductions = m.taxDeduction + m.pensionDeduction;
  return {
    id: `payr_${month}_${m.id}`,
    voucherNo: `SAL-${month.replace('-', '')}-${m.employeeNo.replace('EMP-', '')}`,
    staffId: m.id,
    month,
    baseSalary: m.baseSalary,
    allowances,
    deductions,
    netPay: Math.max(0, m.baseSalary + allowances - deductions),
    status: 'Pending',
    paidDate: null,
    paymentMethod: method,
  };
}

function clearRecords(s: Store): void {
  s.feePayments = [];
  s.payroll = [];
  s.students = [];
  s.classes = [];
  s.staff = [];
  s.expenses = [];
  s.notices = [];
}

// ---------- fetch interception ----------

function headerValue(headers: HeadersInit | undefined, name: string): string {
  if (!headers) return '';
  if (headers instanceof Headers) return headers.get(name) || '';
  if (Array.isArray(headers)) {
    const hit = headers.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return hit ? hit[1] : '';
  }
  const rec = headers as Record<string, string>;
  const k = Object.keys(rec).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? rec[k] : '';
}

export function installLocalApi(): void {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!rawUrl.startsWith('/api/')) return realFetch(input, init);

    const url = new URL(rawUrl, 'http://local.invalid');
    const method = (init?.method || 'GET').toUpperCase();
    let body: Record<string, any> = {};
    if (typeof init?.body === 'string' && init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = {};
      }
    }
    const auth = headerValue(init?.headers, 'Authorization');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const store = load();

    let status = 200;
    let payload: unknown;
    try {
      const res = route({
        method,
        path: url.pathname,
        query: url.searchParams,
        body,
        token,
        store,
        user: userFromToken(store, token),
      });
      status = res.status ?? 200;
      payload = res.json;
    } catch (err) {
      if (err instanceof HttpError) {
        status = err.status;
        payload = { error: err.message };
      } else {
        console.error('Local ledger error:', err);
        status = 500;
        payload = { error: 'Something went wrong saving to this device.' };
      }
    }
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
