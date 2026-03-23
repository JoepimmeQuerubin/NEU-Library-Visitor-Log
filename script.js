/* ═══════════════════════════════════════════════
   NEU LIBRARY VISITOR SYSTEM — SCRIPT.JS
═══════════════════════════════════════════════ */

// ─── SUPABASE CONFIG ───
const SUPABASE_URL = 'https://uygqwtyplzzhiklyncbd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5Z3F3dHlwbHp6aGlrbHluY2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODExMzAsImV4cCI6MjA4OTc1NzEzMH0.ku4whWtBMUz5vpKDd679LKNmkBw2XjRMQ7vBQccR4Oo';
const ADMIN_EMAIL   = 'jcesperanza@neu.edu.ph';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── STATE ───
let currentUser   = null;
let currentProfile = null;
let allVisitors    = [];
let allUsers       = [];
let allLogs        = [];
let reportData     = [];
let chartInstances = {};
let activeVisitId  = null;
let monitorInterval = null;
let clockInterval   = null;
let selectedLoginRole = 'user';  // role chosen on landing screen
let activeDateFilter  = 'all';   // date filter for all visitors
let _adminLogs        = [];      // cached logs for client-side stats filtering
let _sfPeriod         = 'today'; // stats page period filter

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', async () => {
  startClock();

  // Always clear any stored session on fresh page load —
  // users must always start at the landing page and sign in each visit.
  localStorage.removeItem('neu_user');

  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
    showPage('login-page');
  }, 2000);
});

/* ══════════════════════════════════════════════════
   LOGIN SCREEN NAVIGATION
══════════════════════════════════════════════════ */
function showLoginScreen(screen) {
  document.querySelectorAll('.lp-screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(`lp-screen-${screen}`).classList.remove('hidden');
}

function selectRole(role) {
  selectedLoginRole = role;
  // Update role badge text/icon on signin + manual screens
  const isAdmin = role === 'admin';
  const icon  = isAdmin ? 'fa-shield-halved' : 'fa-graduation-cap';
  const label = isAdmin ? 'Administrator' : 'Regular User';
  ['lp-role-badge', 'lp-role-badge-2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.querySelector('i').className = `fa-solid ${icon}`;
      el.querySelector('span').textContent = label;
      el.className = `lp-role-badge ${isAdmin ? 'admin' : ''}`;
    }
  });
  showLoginScreen('signin');
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}

/* ══════════════════════════════════════════════════
   GOOGLE SIGN IN
══════════════════════════════════════════════════ */
async function handleGoogleSignIn(response) {
  try {
    const payload = parseJwt(response.credential);
    const email   = payload.email;

    if (!email.endsWith('@neu.edu.ph')) {
      showToast('Access restricted to @neu.edu.ph accounts only.', 'error');
      return;
    }

    currentUser = { email, name: payload.name, picture: payload.picture };
    localStorage.setItem('neu_user', JSON.stringify(currentUser));

    await loadProfile(email);
  } catch (err) {
    console.error(err);
    showToast('Sign-in failed. Please try again.', 'error');
  }
}

function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json    = decodeURIComponent(atob(base64).split('').map(c =>
    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  return JSON.parse(json);
}

/* ══════════════════════════════════════════════════
   MANUAL LOGIN — email only, no password required
══════════════════════════════════════════════════ */
async function manualLogin() {
  const email = document.getElementById('ml-email').value.trim().toLowerCase();

  if (!email) { showToast('Please enter your email address.', 'warning'); return; }
  if (!email.endsWith('@neu.edu.ph')) { showToast('Only @neu.edu.ph accounts are allowed.', 'error'); return; }

  // Look up profile by email
  const { data, error } = await db.from('profiles').select('*').eq('email', email).maybeSingle();

  if (error) { showToast('Database error: ' + error.message, 'error'); return; }

  if (!data) {
    // No account yet — send to register with email pre-filled
    document.getElementById('reg-email').value = email;
    showLoginScreen('register');
    showToast('No account found. Please complete registration.', 'info');
    return;
  }

  if (data.is_blocked) { showToast('Your account has been blocked. Contact the administrator.', 'error'); return; }

  currentUser    = { email, name: data.name, picture: data.picture };
  currentProfile = data;
  localStorage.setItem('neu_user', JSON.stringify(currentUser));

  // Auto-elevate hardcoded admin email if not yet set in DB
  if (email === ADMIN_EMAIL && data.role !== 'admin') {
    await db.from('profiles').update({ role: 'admin' }).eq('email', email);
    currentProfile.role = 'admin';
  }

  // Route based on DB role — any user with role='admin' can access admin panel
  await logActivity(email, 'login', `${data.name} signed in`);
  afterLogin();
}

/* ══════════════════════════════════════════════════
   REGISTER — no password, email + profile info only
══════════════════════════════════════════════════ */
async function registerManual() {
  const name       = document.getElementById('reg-name').value.trim();
  const email      = document.getElementById('reg-email').value.trim().toLowerCase();
  const studentId  = document.getElementById('reg-student-id').value.trim();
  const college    = document.getElementById('reg-college').value;
  const isEmployee = document.getElementById('reg-employee').checked;

  if (!name || !email || !studentId || !college) {
    showToast('Please fill in all fields.', 'warning'); return;
  }
  if (!email.endsWith('@neu.edu.ph')) {
    showToast('Only @neu.edu.ph email addresses are allowed.', 'error'); return;
  }

  // Check if email already exists
  const { data: existing } = await db.from('profiles').select('email').eq('email', email).maybeSingle();
  if (existing) { showToast('An account with this email already exists.', 'error'); return; }

  // Seed admin role for the designated admin email; others get 'user' (can be promoted via admin panel)
  const role = email === ADMIN_EMAIL ? 'admin' : 'user';

  const { data, error } = await db.from('profiles').insert([{
    email,
    name,
    student_id:    studentId,
    college,
    employee_type: isEmployee ? 'Employee' : 'Student',
    role,
    registered_at: new Date().toISOString(),
    picture:       null,
    is_blocked:    false
  }]).select().single();

  if (error) { showToast('Registration failed: ' + error.message, 'error'); return; }

  currentUser    = { email, name, picture: null };
  currentProfile = data;
  localStorage.setItem('neu_user', JSON.stringify(currentUser));

  await logActivity(email, 'register', `${name} registered`);
  showToast('Account created! Welcome to NEU Library.', 'success');
  afterLogin();
}

/* ══════════════════════════════════════════════════
   LOAD PROFILE (Google flow)
══════════════════════════════════════════════════ */
async function loadProfile(email) {
  const { data, error } = await db.from('profiles').select('*').eq('email', email).maybeSingle();

  if (error) {
    showToast('Database error: ' + error.message, 'error');
    showPage('login-page');
    return;
  }

  if (!data) {
    // Google user with no profile yet — auto-create with Google info
    showLoginScreen('welcome');
    showPage('login-page');
    // Show a prompt for them to complete profile via the register screen
    // Pre-fill email from Google
    document.getElementById('reg-email').value = email;
    document.getElementById('reg-name').value  = currentUser.name || '';
    showLoginScreen('register');
    showToast('Please complete your profile to continue.', 'info');
    return;
  }

  if (data.is_blocked) {
    showToast('Your account has been blocked. Contact the administrator.', 'error');
    localStorage.removeItem('neu_user');
    showPage('login-page');
    return;
  }

  currentProfile = data;

  // Auto-elevate hardcoded admin email
  if (email === ADMIN_EMAIL && data.role !== 'admin') {
    await db.from('profiles').update({ role: 'admin' }).eq('email', email);
    currentProfile.role = 'admin';
  }

  // Route based on role from DB — any role='admin' user gets admin access
  await logActivity(email, 'login', `${data.name} signed in`);
  afterLogin();
}

/* ══════════════════════════════════════════════════
   AFTER LOGIN
══════════════════════════════════════════════════ */
function afterLogin() {
  const isAdmin = currentProfile.role === 'admin';

  if (selectedLoginRole === 'admin') {
    // User chose "Administrator" on landing screen
    if (!isAdmin) {
      // Not actually an admin in DB — deny and redirect back to login
      showToast('Your account does not have administrator access.', 'error');
      currentUser = null; currentProfile = null;
      localStorage.removeItem('neu_user');
      showPage('login-page');
      showLoginScreen('welcome');
      return;
    }
    currentProfile._viewRole = 'admin';
    showApp();
  } else if (selectedLoginRole === 'user') {
    // User chose "Regular User" — always allowed, even if they have admin role
    currentProfile._viewRole = 'user';
    showApp();
  } else {
    // Google sign-in path (selectedLoginRole not explicitly set) —
    // show role picker if they have admin role, else go straight to user view
    if (isAdmin) {
      showPage('login-page');
      showLoginScreen('role');
    } else {
      currentProfile._viewRole = 'user';
      showApp();
    }
  }
}

function enterAsRole(role) {
  currentProfile._viewRole = role;
  showApp();
}

/* ══════════════════════════════════════════════════
   ROLE SWITCH — secure, re-verified from DB
══════════════════════════════════════════════════ */
async function switchRole() {
  if (!currentProfile || !currentUser) return;

  const currentView = currentProfile._viewRole || currentProfile.role;
  const targetView  = currentView === 'admin' ? 'user' : 'admin';

  // If switching TO admin — re-verify role from DB first (security check)
  if (targetView === 'admin') {
    const { data, error } = await db
      .from('profiles').select('role, is_blocked')
      .eq('email', currentUser.email).maybeSingle();

    if (error || !data) {
      showToast('Could not verify your account. Please sign in again.', 'error');
      logout(); return;
    }
    if (data.is_blocked) {
      showToast('Your account has been blocked.', 'error');
      logout(); return;
    }
    if (data.role !== 'admin') {
      showToast('You do not have administrator access.', 'error');
      // Strip any cached admin role — account was demoted
      currentProfile.role      = data.role;
      currentProfile._viewRole = 'user';
      showApp(); return;
    }
    // Role confirmed in DB — safe to switch
    currentProfile.role = data.role; // refresh from DB
    await logActivity(currentUser.email, 'role-switch', `${currentProfile.name} switched to Admin View`);
  } else {
    await logActivity(currentUser.email, 'role-switch', `${currentProfile.name} switched to User View`);
  }

  currentProfile._viewRole = targetView;
  showApp();
  showToast(
    targetView === 'admin' ? '🛡️ Switched to Admin View' : '👤 Switched to User View',
    'success'
  );
}

/* ══════════════════════════════════════════════════
   CHECK IN / CHECK OUT
/* ══════════════════════════════════════════════════
   APP BOOTSTRAP
══════════════════════════════════════════════════ */
function showApp() {
  hidePage('login-page');
  document.getElementById('app').classList.remove('hidden');

  const effectiveRole = currentProfile._viewRole || currentProfile.role;
  const isActualAdmin = currentProfile.role === 'admin';

  // Populate sidebar
  document.getElementById('sidebar-name').textContent = currentProfile.name;
  document.getElementById('sidebar-role').textContent =
    currentProfile.employee_type === 'Employee' ? 'Employee' : 'Student';
  document.getElementById('sidebar-avatar').src = currentProfile.picture || generateAvatar(currentProfile.name);

  // View chip — shows current active view for admin-role users
  const chip      = document.getElementById('sidebar-view-chip');
  const chipLabel = document.getElementById('sidebar-view-label');
  if (isActualAdmin) {
    chip.classList.remove('hidden');
    chip.className = `sidebar-view-chip ${effectiveRole === 'admin' ? 'admin' : 'user'}`;
    chipLabel.textContent = effectiveRole === 'admin' ? 'Admin View' : 'User View';
  } else {
    chip.classList.add('hidden');
  }

  // Switch role button — only shown to actual admins
  const switchBtn   = document.getElementById('btn-switch-role');
  const switchLabel = document.getElementById('switch-role-label');
  const switchIcon  = document.getElementById('switch-role-icon');
  if (isActualAdmin) {
    switchBtn.classList.remove('hidden');
    if (effectiveRole === 'admin') {
      switchLabel.textContent = 'Switch to User View';
      switchIcon.className    = 'fa-solid fa-user';
      switchBtn.className     = 'btn-switch-role to-user';
    } else {
      switchLabel.textContent = 'Switch to Admin View';
      switchIcon.className    = 'fa-solid fa-shield-halved';
      switchBtn.className     = 'btn-switch-role to-admin';
    }
  } else {
    switchBtn.classList.add('hidden');
  }

  // Show/hide navs based on effective role
  if (effectiveRole === 'admin') {
    document.getElementById('admin-nav').classList.remove('hidden');
    document.getElementById('user-nav').classList.add('hidden');
  } else {
    document.getElementById('admin-nav').classList.add('hidden');
    document.getElementById('user-nav').classList.remove('hidden');
  }

  showWelcomeOverlay();
  navigate(effectiveRole === 'admin' ? 'admin-overview' : 'dashboard');

  clearInterval(monitorInterval);
  monitorInterval = setInterval(refreshActiveCount, 30000);
  refreshActiveCount();
}

function showWelcomeOverlay() {
  const hour = new Date().getHours();
  let greeting = 'Good Evening';
  let icon = 'fa-moon';
  if (hour < 12) { greeting = 'Good Morning'; icon = 'fa-sun'; }
  else if (hour < 17) { greeting = 'Good Afternoon'; icon = 'fa-cloud-sun'; }

  document.getElementById('welcome-greeting').textContent = greeting;
  document.getElementById('welcome-name').textContent = currentProfile.name;
  document.getElementById('welcome-time').textContent = formatTimeNow();

  const iconEl = document.querySelector('.welcome-icon i');
  iconEl.className = `fa-solid ${icon}`;

  const overlay = document.getElementById('welcome-overlay');
  overlay.classList.remove('hidden');

  setTimeout(() => overlay.classList.add('hidden'), 3000);
}

/* ══════════════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════════════ */
function navigate(page) {
  // Hide all sections
  document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const section = document.getElementById(`page-${page}`);
  if (section) section.classList.remove('hidden');

  // Mark active nav
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Topbar title
  const titles = {
    'dashboard':       'Dashboard',
    'checkin':         'Check In',
    'history':         'My History',
    'admin-overview':  'Admin Overview',
    'admin-monitor':   'Live Monitor',
    'admin-visitors':  'All Visitors',
    'admin-users':     'Manage Users',
    'admin-stats':     'Statistics',
    'admin-logs':      'Activity Logs',
    'admin-reports':   'Reports'
  };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // Load data
  switch (page) {
    case 'dashboard':      loadDashboard();   break;
    case 'checkin':        loadCheckinForm(); break;
    case 'history':        loadHistory();     break;
    case 'admin-overview': loadAdminOverview(); break;
    case 'admin-monitor':  loadMonitor();     break;
    case 'admin-visitors': loadAllVisitors(); break;
    case 'admin-users':    loadAllUsers();    break;
    case 'admin-stats':    loadStats();       break;
    case 'admin-logs':     loadLogs();        break;
  }

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ══════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════ */
async function loadDashboard() {
  const hour = new Date().getHours();
  let greet = 'Good Evening, Scholar';
  if (hour < 12) greet = 'Good Morning, Scholar';
  else if (hour < 17) greet = 'Good Afternoon, Scholar';
  document.getElementById('dash-greeting').textContent = greet;

  const { data: logs } = await db.from('visitor_logs')
    .select('*').eq('email', currentProfile.email)
    .order('date', { ascending: false });

  if (!logs) return;

  // Stats
  document.getElementById('stat-total-visits').textContent = logs.length;

  let totalMinutes = 0;
  logs.forEach(log => {
    if (log.time_in && log.time_out) {
      totalMinutes += timeDiff(log.time_in, log.time_out);
    }
  });
  document.getElementById('stat-hours').textContent = Math.round(totalMinutes / 60) + 'h';

  // Streak
  const streak = calcStreak(logs);
  document.getElementById('stat-streak').textContent = streak;

  // Rank
  const { data: allData } = await db.from('visitor_logs').select('email');
  if (allData) {
    const counts = {};
    allData.forEach(r => { counts[r.email] = (counts[r.email] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([e]) => e === currentProfile.email) + 1;
    document.getElementById('stat-rank').textContent = rank ? `#${rank}` : '#—';
  }

  // Active visit check
  const active = logs.find(l => !l.time_out);
  if (active) {
    activeVisitId = active.id;
    document.getElementById('active-visit-banner').classList.remove('hidden');
    document.getElementById('active-visit-info').textContent = `Checked in at ${active.time_in} — ${active.reason}`;
  } else {
    activeVisitId = null;
    document.getElementById('active-visit-banner').classList.add('hidden');
  }

  // Recent visits
  const tbody = document.getElementById('recent-visits-body');
  const recent = logs.slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No visits yet.</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(log => {
    const duration = log.time_out ? minutesToHM(timeDiff(log.time_in, log.time_out)) : '<span style="color:var(--success)">Active</span>';
    return `<tr>
      <td>${log.date}</td>
      <td>${log.time_in}</td>
      <td>${log.time_out || '—'}</td>
      <td>${log.reason}</td>
      <td>${log.college}</td>
      <td>${duration}</td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════
   CHECK IN / CHECK OUT
══════════════════════════════════════════════════ */
function loadCheckinForm() {
  const p = currentProfile;
  document.getElementById('checkin-form-name').textContent = p.name;
  document.getElementById('checkin-form-id').textContent   = p.student_id + ' · ' + p.college;
  document.getElementById('checkin-avatar').src            = p.picture || generateAvatar(p.name);
  if (p.college) document.getElementById('ci-college').value = p.college;
  if (p.employee_type === 'Employee') document.getElementById('ci-employee').checked = true;
}

async function checkIn() {
  const reason   = document.getElementById('ci-reason').value;
  const college  = document.getElementById('ci-college').value;
  const employee = document.getElementById('ci-employee').checked;

  if (!reason || !college) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  // Check if already checked in
  const { data: existing } = await db.from('visitor_logs')
    .select('id').eq('email', currentProfile.email).is('time_out', null);

  if (existing && existing.length > 0) {
    showToast('You are already checked in. Please check out first.', 'warning');
    return;
  }

  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const timeIn = formatTimeNow();

  const { data, error } = await db.from('visitor_logs').insert([{
    email:         currentProfile.email,
    name:          currentProfile.name,
    student_id:    currentProfile.student_id,
    college,
    reason,
    employee_type: employee ? 'Employee' : 'Student',
    date:          today,
    time_in:       timeIn,
    time_out:      null
  }]).select().single();

  if (error) {
    showToast('Check-in failed: ' + error.message, 'error');
    return;
  }

  activeVisitId = data.id;
  await logActivity(currentProfile.email, 'check-in', `${currentProfile.name} checked in for: ${reason}`);

  // Show success overlay
  document.getElementById('checkin-name').textContent          = currentProfile.name;
  document.getElementById('checkin-reason').textContent        = reason + ' · ' + college;
  document.getElementById('checkin-time-display').textContent  = timeIn;

  const overlay = document.getElementById('checkin-overlay');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.classList.add('hidden');
    navigate('dashboard');
  }, 2800);

  refreshActiveCount();
}

async function checkOut(logId) {
  const id = logId || activeVisitId;
  if (!id) return;

  const timeOut = formatTimeNow();

  const { error } = await db.from('visitor_logs')
    .update({ time_out: timeOut }).eq('id', id);

  if (error) {
    showToast('Check-out failed: ' + error.message, 'error');
    return;
  }

  activeVisitId = null;
  await logActivity(currentProfile.email, 'check-out', `${currentProfile.name} checked out at ${timeOut}`);
  showToast('Checked out successfully!', 'success');
  loadDashboard();
  refreshActiveCount();
}

async function refreshActiveCount() {
  const { data } = await db.from('visitor_logs').select('id').is('time_out', null);
  const count = data ? data.length : 0;
  document.getElementById('active-count-badge').textContent = count;
}

/* ══════════════════════════════════════════════════
   HISTORY
══════════════════════════════════════════════════ */
async function loadHistory() {
  const { data } = await db.from('visitor_logs')
    .select('*').eq('email', currentProfile.email)
    .order('date', { ascending: false });

  allVisitors = data || [];
  renderHistory(allVisitors);
}

function renderHistory(logs) {
  const tbody = document.getElementById('history-body');
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No visits recorded.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(log => {
    const duration = log.time_out ? minutesToHM(timeDiff(log.time_in, log.time_out)) : '<span style="color:var(--success)">Active</span>';
    const action = !log.time_out
      ? `<button class="btn-sm btn-checkout" onclick="checkOut(${log.id})"><i class="fa-solid fa-right-from-bracket"></i> Check Out</button>`
      : '<span style="color:var(--text-dim)">Done</span>';
    return `<tr>
      <td>${log.date}</td>
      <td>${log.time_in}</td>
      <td>${log.time_out || '—'}</td>
      <td>${log.reason}</td>
      <td>${log.college}</td>
      <td>${duration}</td>
      <td>${action}</td>
    </tr>`;
  }).join('');
}

function filterHistory() {
  const q = document.getElementById('history-search').value.toLowerCase();
  renderHistory(allVisitors.filter(l =>
    l.reason.toLowerCase().includes(q) ||
    l.college.toLowerCase().includes(q) ||
    l.date.includes(q)
  ));
}

/* ══════════════════════════════════════════════════
   ADMIN OVERVIEW
══════════════════════════════════════════════════ */
async function loadAdminOverview() {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayLogs } = await db.from('visitor_logs').select('*').eq('date', today);
  const logs = todayLogs || [];

  const active = logs.filter(l => !l.time_out);
  document.getElementById('adm-total-visits').textContent = logs.length;
  document.getElementById('adm-active').textContent       = active.length;

  let totalMin = 0;
  logs.forEach(l => { if (l.time_in && l.time_out) totalMin += timeDiff(l.time_in, l.time_out); });
  document.getElementById('adm-hours').textContent   = Math.round(totalMin / 60) + 'h';
  document.getElementById('adm-unique').textContent  = new Set(logs.map(l => l.email)).size;

  // Charts
  buildPieChart('chart-reason', 'Reason', countBy(logs, 'reason'));
  buildPieChart('chart-college', 'College', countBy(logs, 'college'));
}

/* ══════════════════════════════════════════════════
   ADMIN MONITOR
══════════════════════════════════════════════════ */
async function loadMonitor() {
  const { data } = await db.from('visitor_logs')
    .select('*').is('time_out', null)
    .order('time_in', { ascending: false });

  const tbody = document.getElementById('monitor-body');
  if (!data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No active visitors.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(log => {
    const elapsed = elapsedSince(log.date, log.time_in);
    return `<tr>
      <td><strong style="color:var(--parchment)">${log.name}</strong></td>
      <td style="font-family:'DM Mono',monospace;font-size:0.82rem">${log.student_id}</td>
      <td>${log.college}</td>
      <td>${log.reason}</td>
      <td style="font-family:'DM Mono',monospace">${log.time_in}</td>
      <td style="color:var(--success)">${elapsed}</td>
      <td style="display:flex;gap:0.4rem">
        <button class="btn-sm btn-warn" onclick="adminCheckOut(${log.id}, '${log.email}', '${log.name}')">
          <i class="fa-solid fa-right-from-bracket"></i> Force Out
        </button>
        <button class="btn-sm btn-danger" onclick="blockUser('${log.email}', '${log.name}')">
          <i class="fa-solid fa-ban"></i> Block
        </button>
      </td>
    </tr>`;
  }).join('');
}

async function adminCheckOut(id, email, name) {
  const timeOut = formatTimeNow();
  await db.from('visitor_logs').update({ time_out: timeOut }).eq('id', id);
  await logActivity(currentProfile.email, 'force-checkout', `Force checked out ${name}`);
  showToast(`${name} checked out.`, 'success');
  loadMonitor();
  refreshActiveCount();
}

async function blockUser(email, name) {
  if (!confirm(`Block ${name}? They will lose access.`)) return;
  await db.from('profiles').update({ is_blocked: true }).eq('email', email);
  await logActivity(currentProfile.email, 'block-user', `Blocked user: ${name} (${email})`);
  showToast(`${name} has been blocked.`, 'warning');
  loadMonitor();
}

/* ══════════════════════════════════════════════════
   ADMIN ALL VISITORS
══════════════════════════════════════════════════ */
async function loadAllVisitors() {
  const { data } = await db.from('visitor_logs').select('*').order('date', { ascending: false });
  allVisitors = data || [];
  renderAllVisitors(allVisitors);
}

function renderAllVisitors(logs) {
  const tbody = document.getElementById('visitors-body');
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No records found.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(log => {
    const duration = log.time_out ? minutesToHM(timeDiff(log.time_in, log.time_out)) : '<span style="color:var(--success)">Active</span>';
    return `<tr>
      <td>${log.date}</td>
      <td><strong style="color:var(--parchment)">${log.name}</strong></td>
      <td style="font-family:'DM Mono',monospace;font-size:0.82rem">${log.student_id}</td>
      <td>${log.college}</td>
      <td>${log.reason}</td>
      <td>${log.time_in}</td>
      <td>${log.time_out || '—'}</td>
      <td>${duration}</td>
    </tr>`;
  }).join('');
}

// ── Date filter state
function setDateFilter(type) {
  activeDateFilter = type;
  // Update active button
  ['all','today','week','month'].forEach(t => {
    const el = document.getElementById(`df-${t}`);
    if (el) el.classList.toggle('active', t === type);
  });
  if (type !== 'custom') {
    document.getElementById('df-from').value = '';
    document.getElementById('df-to').value   = '';
  }
  filterVisitors();
}

function getDateRange() {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  if (activeDateFilter === 'today') {
    const t = fmt(today);
    return { from: t, to: t };
  }
  if (activeDateFilter === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { from: fmt(start), to: fmt(today) };
  }
  if (activeDateFilter === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: fmt(today) };
  }
  if (activeDateFilter === 'custom') {
    return {
      from: document.getElementById('df-from').value || null,
      to:   document.getElementById('df-to').value   || null
    };
  }
  return { from: null, to: null };
}

function filterVisitors() {
  const q    = document.getElementById('visitors-search').value.toLowerCase().trim();
  const sort = document.getElementById('visitors-sort').value;
  const { from, to } = getDateRange();

  let filtered = allVisitors.filter(l => {
    // Date range filter
    if (from && l.date < from) return false;
    if (to   && l.date > to)   return false;
    // Search filter
    if (!q) return true;
    return (l.name        || '').toLowerCase().includes(q) ||
           (l.email       || '').toLowerCase().includes(q) ||
           (l.college     || '').toLowerCase().includes(q) ||
           (l.reason      || '').toLowerCase().includes(q) ||
           (l.student_id  || '').toLowerCase().includes(q) ||
           (l.date        || '').includes(q);
  });

  if (sort === 'date-asc')  filtered.sort((a,b) => a.date.localeCompare(b.date));
  if (sort === 'date-desc') filtered.sort((a,b) => b.date.localeCompare(a.date));
  if (sort === 'name-asc')  filtered.sort((a,b) => a.name.localeCompare(b.name));

  renderAllVisitors(filtered);
}

// ── Autocomplete suggestions for visitor search
function onVisitorSearchInput() {
  filterVisitors();
  const q = document.getElementById('visitors-search').value.trim().toLowerCase();
  const dropdown = document.getElementById('visitors-suggestions');
  if (!q || q.length < 2) { dropdown.classList.add('hidden'); return; }

  // Build unique suggestion pool from allVisitors fields
  const pool = new Set();
  allVisitors.forEach(l => {
    if (l.name    && l.name.toLowerCase().includes(q))    pool.add(l.name);
    if (l.email   && l.email.toLowerCase().includes(q))   pool.add(l.email);
    if (l.college && l.college.toLowerCase().includes(q)) pool.add(l.college);
    if (l.reason  && l.reason.toLowerCase().includes(q))  pool.add(l.reason);
  });

  const matches = [...pool].slice(0, 8);
  if (!matches.length) { dropdown.classList.add('hidden'); return; }

  dropdown.innerHTML = matches.map(m =>
    `<div class="suggestion-item" onclick="applySuggestion('${m.replace(/'/g,"\'")}')">${highlightMatch(m, q)}</div>`
  ).join('');
  dropdown.classList.remove('hidden');
}

function applySuggestion(value) {
  document.getElementById('visitors-search').value = value;
  document.getElementById('visitors-suggestions').classList.add('hidden');
  filterVisitors();
}

function highlightMatch(text, query) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return text.slice(0, idx) +
    `<mark>${text.slice(idx, idx + query.length)}</mark>` +
    text.slice(idx + query.length);
}

// Close suggestions when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    const d = document.getElementById('visitors-suggestions');
    if (d) d.classList.add('hidden');
  }
});

/* ══════════════════════════════════════════════════
   ADMIN MANAGE USERS
══════════════════════════════════════════════════ */
async function loadAllUsers() {
  const { data } = await db.from('profiles').select('*').order('registered_at', { ascending: false });
  allUsers = data || [];
  renderUsers(allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById('users-body');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No users found.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => {
    const statusBadge = u.is_blocked
      ? '<span class="badge badge-blocked">Blocked</span>'
      : '<span class="badge badge-active">Active</span>';
    const roleBadge = u.role === 'admin'
      ? '<span class="badge badge-admin">Admin</span>'
      : '<span class="badge badge-user">User</span>';
    const blockBtn = u.is_blocked
      ? `<button class="btn-sm btn-green" onclick="toggleBlock('${u.email}', '${u.name}', false)"><i class="fa-solid fa-lock-open"></i> Unblock</button>`
      : `<button class="btn-sm btn-warn" onclick="toggleBlock('${u.email}', '${u.name}', true)"><i class="fa-solid fa-ban"></i> Block</button>`;
    const reg = u.registered_at ? u.registered_at.split('T')[0] : '—';
    return `<tr>
      <td><strong style="color:var(--parchment)">${u.name}</strong></td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${u.email}</td>
      <td style="font-family:'DM Mono',monospace;font-size:0.82rem">${u.student_id || '—'}</td>
      <td>${u.college || '—'}</td>
      <td>${roleBadge}</td>
      <td>${statusBadge}</td>
      <td style="font-size:0.82rem;color:var(--text-muted)">${reg}</td>
      <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
        <button class="btn-sm btn-blue" onclick="openEditUser('${u.email}')"><i class="fa-solid fa-pen"></i> Edit</button>
        ${blockBtn}
      </td>
    </tr>`;
  }).join('');
}

function filterUsers() {
  const q = document.getElementById('users-search').value.toLowerCase();
  renderUsers(allUsers.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.college || '').toLowerCase().includes(q)
  ));
}

function openAddUserModal() {
  document.getElementById('modal-user-title').textContent = 'Add New User';
  document.getElementById('modal-user-id').value = '';
  ['mu-name','mu-email','mu-student-id'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('mu-college').value = '';
  document.getElementById('mu-role').value = 'user';
  document.getElementById('modal-user').classList.remove('hidden');
}

function openEditUser(email) {
  const u = allUsers.find(x => x.email === email);
  if (!u) return;
  document.getElementById('modal-user-title').textContent  = 'Edit User';
  document.getElementById('modal-user-id').value           = u.email;
  document.getElementById('mu-name').value                 = u.name || '';
  document.getElementById('mu-email').value                = u.email;
  document.getElementById('mu-student-id').value           = u.student_id || '';
  document.getElementById('mu-college').value              = u.college || '';
  document.getElementById('mu-role').value                 = u.role || 'user';
  document.getElementById('modal-user').classList.remove('hidden');
}

async function saveUser() {
  const existingEmail = document.getElementById('modal-user-id').value;
  const name       = document.getElementById('mu-name').value.trim();
  const email      = document.getElementById('mu-email').value.trim();
  const studentId  = document.getElementById('mu-student-id').value.trim();
  const college    = document.getElementById('mu-college').value;
  const role       = document.getElementById('mu-role').value;

  if (!name || !email) { showToast('Name and Email are required.', 'warning'); return; }

  if (existingEmail) {
    // Update
    const { error } = await db.from('profiles').update({ name, student_id: studentId, college, role }).eq('email', existingEmail);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    await logActivity(currentProfile.email, 'edit-user', `Edited user: ${name}`);
    showToast('User updated.', 'success');
  } else {
    // Insert
    const { error } = await db.from('profiles').insert([{
      email, name, student_id: studentId, college, role,
      registered_at: new Date().toISOString(), is_blocked: false
    }]);
    if (error) { showToast('Failed: ' + error.message, 'error'); return; }
    await logActivity(currentProfile.email, 'add-user', `Added user: ${name} (${email})`);
    showToast('User added.', 'success');
  }

  closeModal('modal-user');
  loadAllUsers();
}

async function toggleBlock(email, name, block) {
  await db.from('profiles').update({ is_blocked: block }).eq('email', email);
  await logActivity(currentProfile.email, block ? 'block-user' : 'unblock-user', `${block ? 'Blocked' : 'Unblocked'}: ${name}`);
  showToast(`${name} ${block ? 'blocked' : 'unblocked'}.`, block ? 'warning' : 'success');
  loadAllUsers();
}

async function deleteUser(email, name) {
  if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
  await db.from('profiles').delete().eq('email', email);
  await logActivity(currentProfile.email, 'delete-user', `Deleted user: ${name} (${email})`);
  showToast(`${name} deleted.`, 'success');
  loadAllUsers();
}

/* ══════════════════════════════════════════════════
   ADMIN STATISTICS — with full filter system
══════════════════════════════════════════════════ */
async function loadStats() {
  // Fetch all logs once into cache
  const { data: logs } = await db.from('visitor_logs').select('*').order('date', { ascending: false });
  _adminLogs = logs || [];

  // Set default filter to Today and apply
  _sfPeriod = 'today';
  setSFPeriod('today');  // this calls applyStatsFilters() internally
}

function setSFPeriod(period) {
  _sfPeriod = period;
  // Update chip active states
  ['today','week','month','custom'].forEach(p => {
    const el = document.getElementById(`sf-${p}`);
    if (el) el.classList.toggle('active', p === period);
  });
  // Show/hide custom range inputs
  const customRange = document.getElementById('sf-custom-range');
  if (customRange) customRange.classList.toggle('hidden', period !== 'custom');
  if (period !== 'custom') applyStatsFilters();
}

function getSFDateRange() {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const todayStr = fmt(today);

  if (_sfPeriod === 'today') return { from: todayStr, to: todayStr };

  if (_sfPeriod === 'week') {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
    return { from: fmt(start), to: todayStr };
  }
  if (_sfPeriod === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: fmt(start), to: todayStr };
  }
  if (_sfPeriod === 'custom') {
    const from = document.getElementById('sf-from')?.value || null;
    const to   = document.getElementById('sf-to')?.value   || null;
    return { from, to };
  }
  return { from: null, to: null };
}

function applyStatsFilters() {
  const { from, to }  = getSFDateRange();
  const reasonFilter  = document.getElementById('sf-reason')?.value  || '';
  const collegeFilter = document.getElementById('sf-college')?.value || '';
  const typeFilter    = document.getElementById('sf-type')?.value    || '';

  const filtered = _adminLogs.filter(l => {
    if (from && l.date < from) return false;
    if (to   && l.date > to)   return false;
    if (reasonFilter  && l.reason        !== reasonFilter)  return false;
    if (collegeFilter && l.college       !== collegeFilter) return false;
    if (typeFilter    && l.employee_type !== typeFilter)    return false;
    return true;
  });

  // ── Stat cards ──
  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('sf-stat-total').textContent  = filtered.length;
  document.getElementById('sf-stat-unique').textContent = new Set(filtered.map(l => l.email)).size;
  document.getElementById('sf-stat-active').textContent = filtered.filter(l => !l.time_out).length;
  document.getElementById('sf-stat-today').textContent  = filtered.filter(l => l.date === todayStr).length;

  // ── Daily trend chart (within filtered range, grouped by date) ──
  const dayMap = {};
  if (from && to) {
    // Fill all dates in range
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      dayMap[cur.toISOString().split('T')[0]] = 0;
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    // Last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dayMap[d.toISOString().split('T')[0]] = 0;
    }
  }
  filtered.forEach(l => { if (dayMap[l.date] !== undefined) dayMap[l.date]++; });
  buildLineChart('chart-daily',
    Object.keys(dayMap).map(d => d.slice(5)),
    Object.values(dayMap)
  );

  // ── Reason distribution chart ──
  buildPieChart('chart-reason-stats', 'Reason', countBy(filtered, 'reason'));

  // ── College distribution chart ──
  buildPieChart('chart-college-stats', 'College', countBy(filtered, 'college'));

  // ── Peak hours bar chart ──
  const hours = Array(24).fill(0);
  filtered.forEach(l => {
    if (l.time_in) { const h = parseInt(l.time_in.split(':')[0]); if (!isNaN(h)) hours[h]++; }
  });
  buildBarChart('chart-hours', Array.from({length:24}, (_,i) => `${i}:00`), hours);

  // ── Student vs Employee doughnut ──
  buildPieChart('chart-type', 'Type', countBy(filtered, 'employee_type'));

  // ── Filtered table ──
  const tbody = document.getElementById('stats-table-body');
  const countEl = document.getElementById('sf-count');
  if (countEl) countEl.textContent = `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No records match the selected filters.</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(l => {
    const duration = l.time_out
      ? minutesToHM(timeDiff(l.time_in, l.time_out))
      : '<span style="color:var(--success)">Active</span>';
    return `<tr>
      <td>${l.date}</td>
      <td><strong style="color:var(--parchment)">${l.name}</strong></td>
      <td>${l.college || '—'}</td>
      <td>${l.reason  || '—'}</td>
      <td><span class="badge ${l.employee_type === 'Employee' ? 'badge-admin' : 'badge-user'}">${l.employee_type || 'Student'}</span></td>
      <td>${l.time_in}</td>
      <td>${l.time_out || '—'}</td>
      <td>${duration}</td>
    </tr>`;
  }).join('');
}

/* ══════════════════════════════════════════════════
   ADMIN LOGS
══════════════════════════════════════════════════ */
async function loadLogs() {
  const { data } = await db.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300);
  allLogs = data || [];
  renderLogs(allLogs);
}

function renderLogs(logs) {
  const tbody = document.getElementById('logs-body');
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No activity logged.</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => {
    const ts = new Date(l.created_at).toLocaleString('en-PH');
    return `<tr>
      <td style="font-family:'DM Mono',monospace;font-size:0.8rem;color:var(--text-muted)">${ts}</td>
      <td>${l.performed_by}</td>
      <td><span class="badge badge-user">${l.action}</span></td>
      <td style="color:var(--text-sec)">${l.detail || '—'}</td>
    </tr>`;
  }).join('');
}

function filterLogs() {
  const q = document.getElementById('logs-search').value.toLowerCase();
  renderLogs(allLogs.filter(l =>
    l.performed_by.toLowerCase().includes(q) ||
    l.action.toLowerCase().includes(q) ||
    (l.detail || '').toLowerCase().includes(q)
  ));
}

/* ══════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════ */
async function loadReport() {
  const from    = document.getElementById('rep-from').value;
  const to      = document.getElementById('rep-to').value;
  const college = document.getElementById('rep-college').value;

  let query = db.from('visitor_logs').select('*').order('date', { ascending: false });
  if (from)    query = query.gte('date', from);
  if (to)      query = query.lte('date', to);
  if (college) query = query.eq('college', college);

  const { data } = await query;
  reportData = data || [];

  const tbody = document.getElementById('report-body');
  if (!reportData.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No records for selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = reportData.map(log => {
    const duration = log.time_out ? minutesToHM(timeDiff(log.time_in, log.time_out)) : 'Active';
    return `<tr>
      <td>${log.date}</td>
      <td>${log.name}</td>
      <td>${log.student_id}</td>
      <td>${log.college}</td>
      <td>${log.reason}</td>
      <td>${log.time_in}</td>
      <td>${log.time_out || '—'}</td>
      <td>${duration}</td>
    </tr>`;
  }).join('');
}

function exportExcel() {
  if (!reportData.length) { showToast('No data to export.', 'warning'); return; }
  const ws = XLSX.utils.json_to_sheet(reportData.map(l => ({
    Date: l.date, Name: l.name, 'Student ID': l.student_id, College: l.college,
    Reason: l.reason, 'Time In': l.time_in, 'Time Out': l.time_out || '',
    Duration: l.time_out ? minutesToHM(timeDiff(l.time_in, l.time_out)) : 'Active'
  })));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visitor Logs');
  XLSX.writeFile(wb, `NEU_Library_Report_${Date.now()}.xlsx`);
  showToast('Excel exported!', 'success');
}

function exportPDF() {
  if (!reportData.length) { showToast('No data to export.', 'warning'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.setTextColor(40);
  doc.text('NEU Library — Visitor Log Report', 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString('en-PH')}`, 14, 22);

  doc.autoTable({
    startY: 28,
    head: [['Date','Name','ID','College','Reason','Time In','Time Out','Duration']],
    body: reportData.map(l => [
      l.date, l.name, l.student_id, l.college, l.reason,
      l.time_in, l.time_out || '—',
      l.time_out ? minutesToHM(timeDiff(l.time_in, l.time_out)) : 'Active'
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [92, 53, 32], textColor: 255 }
  });

  doc.save(`NEU_Library_Report_${Date.now()}.pdf`);
  showToast('PDF exported!', 'success');
}

/* ══════════════════════════════════════════════════
   ACTIVITY LOG
══════════════════════════════════════════════════ */
async function logActivity(performedBy, action, detail) {
  await db.from('activity_logs').insert([{
    performed_by: performedBy,
    action,
    detail,
    created_at: new Date().toISOString()
  }]);
}

/* ══════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════ */
async function logout() {
  if (activeVisitId) await checkOut(activeVisitId);
  if (currentProfile) {
    await logActivity(currentProfile.email, 'logout', `${currentProfile.name} signed out`);
  }
  localStorage.removeItem('neu_user');
  currentUser    = null;
  currentProfile = null;
  activeVisitId  = null;
  clearInterval(monitorInterval);

  document.getElementById('app').classList.add('hidden');
  document.getElementById('admin-nav').classList.add('hidden');
  showLoginScreen('welcome');
  showPage('login-page');
}

/* ══════════════════════════════════════════════════
   CHART HELPERS
══════════════════════════════════════════════════ */
const CHART_COLORS = [
  '#c9a84c','#9b7a2a','#5c3520','#2d8a42','#2980b9',
  '#8e44ad','#c0392b','#16a085','#e67e22','#7f8c8d'
];

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function buildPieChart(canvasId, label, dataObj) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(dataObj),
      datasets: [{ data: Object.values(dataObj), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#231510' }]
    },
    options: {
      plugins: {
        legend: { labels: { color: '#c9b48a', font: { family: 'Crimson Pro', size: 12 } } }
      }
    }
  });
}

function buildBarChart(canvasId, labels, values) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Visitors', data: values,
        backgroundColor: 'rgba(201,168,76,0.4)',
        borderColor: '#c9a84c', borderWidth: 1, borderRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a7a5a', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9a7a5a' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
      }
    }
  });
}

function buildLineChart(canvasId, labels, values) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Visitors', data: values,
        borderColor: '#c9a84c',
        backgroundColor: 'rgba(201,168,76,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#c9a84c'
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9a7a5a', maxRotation: 45, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#9a7a5a' }, grid: { color: 'rgba(255,255,255,0.04)' }, beginAtZero: true }
      }
    }
  });
}

/* ══════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════ */
function countBy(arr, key) {
  const counts = {};
  arr.forEach(item => { const v = item[key] || 'Unknown'; counts[v] = (counts[v] || 0) + 1; });
  return counts;
}

function timeDiff(timeIn, timeOut) {
  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  return Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1));
}

function minutesToHM(min) {
  if (min < 60) return min + 'm';
  return Math.floor(min / 60) + 'h ' + (min % 60) + 'm';
}

function elapsedSince(date, timeIn) {
  const [h, m] = timeIn.split(':').map(Number);
  const start = new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
  const diff  = Math.floor((Date.now() - start.getTime()) / 60000);
  if (diff < 1) return 'Just arrived';
  if (diff < 60) return diff + 'm';
  return Math.floor(diff/60) + 'h ' + (diff%60) + 'm';
}

function formatTimeNow() {
  const now = new Date();
  return now.toTimeString().slice(0, 5); // HH:MM
}

function calcStreak(logs) {
  if (!logs.length) return 0;
  const dates = [...new Set(logs.map(l => l.date))].sort().reverse();
  let streak = 0;
  let current = new Date();
  for (const d of dates) {
    const diff = Math.floor((current - new Date(d)) / 86400000);
    if (diff <= 1) { streak++; current = new Date(d); }
    else break;
  }
  return streak;
}

function generateAvatar(name) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const canvas   = document.createElement('canvas');
  canvas.width   = 80; canvas.height = 80;
  const ctx      = canvas.getContext('2d');
  ctx.fillStyle  = '#3d2416';
  ctx.fillRect(0, 0, 80, 80);
  ctx.fillStyle  = '#c9a84c';
  ctx.font       = 'bold 28px Playfair Display, serif';
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 40, 42);
  return canvas.toDataURL();
}

function startClock() {
  function updateClock() {
    const now = new Date();
    const t   = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const d   = now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
    const el  = document.getElementById('topbar-clock');
    if (el) el.textContent = `${d} · ${t}`;
  }
  updateClock();
  clockInterval = setInterval(updateClock, 1000);
}

function showToast(message, type = 'info') {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${message}`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showPage(id) { document.getElementById(id).classList.remove('hidden'); }
function hidePage(id) { document.getElementById(id).classList.add('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
