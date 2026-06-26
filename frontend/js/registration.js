const API_AUTH = 'http://localhost:5000/api/auth';

let currentStep  = 1;
let selectedRole = '';

const roleLabels = {
  dist: 'Distributor / Stockist',
  ret:  'Retailer / Chemist',
  hosp: 'Hospital / Institution',
  mfr:  'Manufacturer'
};

// Map UI role codes to backend role values (must match authController.modelForRole)
const roleMap = {
  dist: 'dist',
  ret:  'ret',
  hosp: 'ret',   // hospital uses retailer pricing tier
  mfr:  'dist'   // manufacturer uses distributor pricing tier
};

// ── Navigation ────────────────────────────────────────────────────────────────

function selectRole(el, role) {
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedRole = role;
  document.getElementById('roleError').style.display = 'none';
}

function gotoStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  currentStep = n;
  updateSidebar(n);
  updateProgress(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goNext(from) {
  if (from === 1 && !selectedRole) {
    document.getElementById('roleError').style.display = 'block';
    return;
  }
  // Validate step 2 before advancing
  if (from === 2 && !validateStep2()) return;
  // Validate step 3 before advancing
  if (from === 3 && !validateStep3()) return;
  // Validate step 4 before advancing
  if (from === 4 && !validateStep4()) return;
  if (from === 5) return;
  gotoStep(from + 1);
  if (from + 1 === 5) populateReview();
}

function goBack(from) {
  if (from <= 1) return;
  gotoStep(from - 1);
}

function updateProgress(step) {
  document.getElementById('progressBar').style.width = (step / 5 * 100) + '%';
}

function updateSidebar(step) {
  for (let i = 1; i <= 5; i++) {
    const el  = document.getElementById('sl-' + i);
    const num = el.querySelector('.step-num');
    el.classList.remove('active', 'done', 'upcoming');
    if (i < step)  { el.classList.add('done');    num.textContent = '✓'; }
    if (i === step){ el.classList.add('active');   num.textContent = i;  }
    if (i > step)  { el.classList.add('upcoming'); num.textContent = i;  }
  }
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function v(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function fieldErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#ef4444';
  let hint = el.parentElement.parentElement.querySelector('.field-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'field-hint';
    hint.style.color = '#ef4444';
    el.parentElement.parentElement.appendChild(hint);
  }
  hint.textContent = msg;
  hint.style.color = '#ef4444';
}

function clearErr(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '';
  const hint = el.parentElement.parentElement.querySelector('.field-hint');
  if (hint) hint.style.color = '';
}

// ── Step validators ───────────────────────────────────────────────────────────

function validateStep2() {
  let ok = true;
  const required = [
    ['bizName',    'Business name is required'],
    ['ownerName',  'Owner name is required'],
    ['bizEmail',   'Email is required'],
    ['bizMobile',  'Mobile number is required'],
    ['bizState',   'State is required'],
    ['bizCity',    'City is required'],
    ['bizPin',     'PIN code is required'],
    ['bizAddress', 'Address is required']
  ];
  required.forEach(function ([id, msg]) {
    if (!v(id)) { fieldErr(id, msg); ok = false; }
    else clearErr(id);
  });

  // Email format
  const email = v('bizEmail');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErr('bizEmail', 'Please enter a valid email address'); ok = false;
  }
  // Mobile — 10 digits
  const mobile = v('bizMobile').replace(/\D/g, '');
  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
    fieldErr('bizMobile', 'Enter a valid 10-digit Indian mobile number'); ok = false;
  }
  // Pincode — 6 digits
  const pin = v('bizPin');
  if (pin && !/^[1-9][0-9]{5}$/.test(pin)) {
    fieldErr('bizPin', 'Enter a valid 6-digit PIN code'); ok = false;
  }
  // GST — optional but validate if provided
  const gst = v('bizGst');
  if (gst && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst.toUpperCase())) {
    fieldErr('bizGst', 'Enter a valid 15-character GST number'); ok = false;
  }

  return ok;
}

function validateStep3() {
  let ok = true;
  [['dlNum', 'Drug license number is required'],
   ['panNum', 'PAN number is required']].forEach(function ([id, msg]) {
    if (!v(id)) { fieldErr(id, msg); ok = false; }
    else clearErr(id);
  });
  const pan = v('panNum');
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(pan)) {
    fieldErr('panNum', 'Enter a valid 10-character PAN (e.g. ABCDE1234F)'); ok = false;
  }
  return ok;
}

function validateStep4() {
  let ok = true;
  const pw1 = document.getElementById('pw1') ? document.getElementById('pw1').value : '';
  const pw2 = document.getElementById('pw2') ? document.getElementById('pw2').value : '';

  if (!pw1 || pw1.length < 12) {
    fieldErr('pw1', 'Password must be at least 12 characters'); ok = false;
  } else if (!/[A-Z]/.test(pw1)) {
    fieldErr('pw1', 'Password must contain at least one uppercase letter'); ok = false;
  } else if (!/[a-z]/.test(pw1)) {
    fieldErr('pw1', 'Password must contain at least one lowercase letter'); ok = false;
  } else if (!/[0-9]/.test(pw1)) {
    fieldErr('pw1', 'Password must contain at least one number'); ok = false;
  } else if (!/[@$!%*?&]/.test(pw1)) {
    fieldErr('pw1', 'Password must contain at least one special character (@$!%*?&)'); ok = false;
  } else {
    clearErr('pw1');
  }

  if (pw1 && pw2 && pw1 !== pw2) {
    fieldErr('pw2', 'Passwords do not match'); ok = false;
  } else if (pw2) clearErr('pw2');

  return ok;
}

// ── Review step ───────────────────────────────────────────────────────────────

function populateReview() {
  document.getElementById('rv-role').textContent      = roleLabels[selectedRole] || '—';
  document.getElementById('rv-bizName').textContent   = v('bizName');
  document.getElementById('rv-ownerName').textContent = v('ownerName');
  document.getElementById('rv-bizEmail').textContent  = v('bizEmail');
  document.getElementById('rv-bizMobile').textContent = v('bizMobile');
  document.getElementById('rv-bizState').textContent  = v('bizState');
  document.getElementById('rv-bizCity').textContent   = v('bizCity');
  document.getElementById('rv-bizGst').textContent    = v('bizGst') || 'Not provided';
  document.getElementById('rv-bizPin').textContent    = v('bizPin');
  document.getElementById('rv-dlNum').textContent     = v('dlNum');
  document.getElementById('rv-dlExpiry').textContent  = v('dlExpiry') || 'Not provided';
  document.getElementById('rv-panNum').textContent    = v('panNum');
  document.getElementById('rv-accName').textContent   = v('accName') || 'Not provided';
  document.getElementById('rv-ifsc').textContent      = v('ifsc')    || 'Not provided';
  document.getElementById('rv-bankName').textContent  = v('bankName')|| 'Not provided';
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function submitForm() {
  if (!document.getElementById('chk1').checked || !document.getElementById('chk2').checked) {
    alert('Please agree to the Terms of Service and confirm document validity to proceed.');
    return;
  }

  const password = document.getElementById('pw1') ? document.getElementById('pw1').value : '';
  const mobile   = v('bizMobile').replace(/\D/g, '');

  const payload = {
    name:              v('ownerName'),
    email:             v('bizEmail'),
    mobile:            mobile,
    password:          password,
    confirmPassword:   document.getElementById('pw2') ? document.getElementById('pw2').value : password,
    role:              roleMap[selectedRole] || 'retailer',
    businessName:      v('bizName'),
    drugLicenseNumber: v('dlNum'),
    gstNumber:         v('bizGst') || undefined,
    panNumber:         v('panNum'),
    state:             v('bizState'),
    city:              v('bizCity'),
    address:           v('bizAddress'),
    pincode:           v('bizPin')
  };

  // Final validation
  const required = ['name', 'email', 'mobile', 'password', 'businessName',
                    'drugLicenseNumber', 'panNumber', 'state', 'city', 'address', 'pincode'];
  const missing  = required.filter(k => !payload[k]);
  if (missing.length) {
    alert('Please complete all required fields: ' + missing.join(', '));
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Submitting…';
  btn.disabled    = true;
  btn.style.opacity = '0.7';

  try {
    const res  = await fetch(`${API_AUTH}/signup`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:    JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) {
      btn.textContent  = '🚀  Submit Application';
      btn.disabled     = false;
      btn.style.opacity = '1';
      alert(data.message || 'Registration failed. Please try again.');
      return;
    }

    // Store token so user is automatically logged in
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user',  JSON.stringify(Object.assign({}, data.user, { role: payload.role })));

    // Show success screen
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('progressBar').style.width = '100%';
    const screen = document.getElementById('successScreen');
    screen.classList.add('show');
    const ref = 'FF-2025-' + Math.floor(10000 + Math.random() * 90000);
    document.getElementById('successRef').textContent = 'Application Ref: ' + ref;
    for (let i = 1; i <= 5; i++) {
      const el = document.getElementById('sl-' + i);
      el.className = 'step-item done';
      el.querySelector('.step-num').textContent = '✓';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    btn.textContent  = '🚀  Submit Application';
    btn.disabled     = false;
    btn.style.opacity = '1';
    alert('Could not reach the server. Is it running on port 5000?');
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  if (inp.type === 'password') { inp.type = 'text';     btn.textContent = 'Hide'; }
  else                         { inp.type = 'password'; btn.textContent = 'Show'; }
}

function checkStrength(val) {
  const bars  = ['bar1','bar2','bar3','bar4'].map(id => document.getElementById(id));
  const label = document.getElementById('pwLabel');
  bars.forEach(b => { if (b) b.className = 'pw-bar'; });
  if (!label) return;
  if (!val) { label.className = 'pw-label'; label.textContent = 'Enter a password'; return; }
  let score = 0;
  if (val.length >= 8)          score++;
  if (/[A-Z]/.test(val))        score++;
  if (/[0-9]/.test(val))        score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    { cls: 'weak',   txt: 'Weak',   color: 'weak-t'   },
    { cls: 'fair',   txt: 'Fair',   color: 'fair-t'   },
    { cls: 'good',   txt: 'Good',   color: 'good-t'   },
    { cls: 'strong', txt: 'Strong', color: 'strong-t' }
  ];
  const lvl = levels[score - 1] || levels[0];
  for (let i = 0; i < score; i++) { if (bars[i]) bars[i].classList.add(lvl.cls); }
  label.className  = 'pw-label ' + lvl.color;
  label.textContent = lvl.txt + ' password';
}

function sendOtp() {
  const mob = document.getElementById('verifyMobile').value.trim();
  if (!mob) { alert('Please enter your mobile number first.'); return; }
  document.getElementById('otpSection').style.display = 'block';
  const btn = document.getElementById('sendOtpBtn');
  btn.textContent = 'Sent ✓';
  btn.disabled    = true;
  setTimeout(() => { btn.textContent = 'Resend OTP'; btn.disabled = false; }, 30000);
  document.getElementById('otp0').focus();
}

function otpNext(el, idx) {
  el.value = el.value.replace(/[^0-9]/g, '');
  if (el.value && idx < 5) document.getElementById('otp' + (idx + 1)).focus();
}

function handleUpload(input, zoneId, valId) {
  if (input.files && input.files[0]) {
    const fname = input.files[0].name;
    document.getElementById(valId).textContent = '✓ ' + fname;
    const zone = document.getElementById(zoneId);
    zone.style.borderColor = 'var(--emerald,#10b981)';
    zone.style.background  = 'rgba(18,184,134,0.07)';
  }
}

function formatDate(el) {
  let val = el.value.replace(/\D/g, '');
  if (val.length >= 3) val = val.slice(0, 2) + ' / ' + val.slice(2);
  if (val.replace(/\D/g, '').length >= 5) val = val.slice(0, 7) + ' / ' + val.replace(/\D/g, '').slice(4);
  el.value = val.slice(0, 14);
}
