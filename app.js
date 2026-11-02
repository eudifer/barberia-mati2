// ===== CONSTANTES =====
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Datos por defecto de los barberos — reemplaza los emails con los reales
const DEFAULT_BARBERS = [
  {
    id: 'b1',
    name: 'Carlos Mendoza',
    email: 'carlos.barbero@gmail.com',
    defaultDays: [2,3,4,5,6], // Mar-Sáb
    hours: { start: '10:00', end: '19:00' },
    slotMinutes: 30,
  },
  {
    id: 'b2',
    name: 'Diego Rojas',
    email: 'diego.barbero@gmail.com',
    defaultDays: [1,2,3,4,5], // Lun-Vie
    hours: { start: '09:00', end: '18:00' },
    slotMinutes: 30,
  },
  {
    id: 'b3',
    name: 'Andrés Silva',
    email: 'andres.barbero@gmail.com',
    defaultDays: [1,2,3,4,5,6], // Lun-Sáb
    hours: { start: '11:00', end: '20:00' },
    slotMinutes: 30,
  }
];

// ===== ESTADO GLOBAL =====
let STATE = {
  currentUser: null,
  barbers: [],
  bookings: [],
  overrides: {},
};

let ACTIVE_SCREEN = 'home';
let BOOKING = { barberId: null, calYear: null, calMonth: null, selectedDate: null, selectedTime: null };
let BARBER_TAB = 'agenda';
let CLIENT_TAB = 'upcoming';
let LOGIN_TARGET = null;
let loginRole = 'client';

// ===== PERSISTENCIA =====
function loadState() {
  try {
    const saved = localStorage.getItem('barberbook_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      STATE.barbers = parsed.barbers || DEFAULT_BARBERS;
      STATE.bookings = parsed.bookings || [];
      STATE.overrides = parsed.overrides || {};
      const user = localStorage.getItem('barberbook_user');
      if (user) STATE.currentUser = JSON.parse(user);
    } else {
      STATE.barbers = JSON.parse(JSON.stringify(DEFAULT_BARBERS));
    }
  } catch(e) {
    STATE.barbers = JSON.parse(JSON.stringify(DEFAULT_BARBERS));
  }
}

function saveState() {
  try {
    localStorage.setItem('barberbook_state', JSON.stringify({
      barbers: STATE.barbers,
      bookings: STATE.bookings,
      overrides: STATE.overrides,
    }));
    if (STATE.currentUser) {
      localStorage.setItem('barberbook_user', JSON.stringify(STATE.currentUser));
    }
  } catch(e) {}
}

// ===== HELPERS =====
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseDate(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d, 12);
}

function fmtDisplayDate(d) {
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

function isBarberAvailable(barberId, dateStr) {
  const barber = STATE.barbers.find(b => b.id === barberId);
  if (!barber) return false;
  const d = parseDate(dateStr);
  const dow = d.getDay();
  const ov = (STATE.overrides[barberId] || []).find(o => o.date === dateStr);
  if (ov) return ov.available;
  return barber.defaultDays.includes(dow);
}

function getBookedSlots(barberId, dateStr) {
  return STATE.bookings
    .filter(b => b.barberId === barberId && b.date === dateStr && b.status !== 'cancelled')
    .map(b => b.time);
}

function generateSlots(barber, dateStr) {
  if (!isBarberAvailable(barber.id, dateStr)) return [];
  const booked = getBookedSlots(barber.id, dateStr);
  const slots = [];
  const [sh, sm] = barber.hours.start.split(':').map(Number);
  const [eh, em] = barber.hours.end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur + barber.slotMinutes <= end) {
    const h = Math.floor(cur/60), m = cur%60;
    const label = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    slots.push({ time: label, booked: booked.includes(label) });
    cur += barber.slotMinutes;
  }
  return slots;
}

function toast(msg, duration=2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ===== ROUTING =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  ACTIVE_SCREEN = name;
  window.scrollTo(0,0);
  if (name === 'home') renderHome();
  else if (name === 'booking') renderBooking();
  else if (name === 'client') renderClient();
  else if (name === 'barber') renderBarber();
}

// ===== NAV =====
function renderNav() {
  const user = STATE.currentUser;
  const actions = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    if (user) {
      const nameBtn = document.createElement('span');
      nameBtn.style.cssText = 'font-size:13px;font-weight:500;color:var(--fg-2);margin-right:4px';
      nameBtn.textContent = user.name;
      el.appendChild(nameBtn);
      if (user.role === 'barber') {
        const db = document.createElement('button');
        db.className = 'btn btn-ghost btn-sm';
        db.textContent = 'Panel';
        db.onclick = () => showScreen('barber');
        el.appendChild(db);
      }
      if (user.role === 'client') {
        const ca = document.createElement('button');
        ca.className = 'btn btn-ghost btn-sm';
        ca.textContent = 'Mis citas';
        ca.onclick = () => showScreen('client');
        el.appendChild(ca);
      }
      const lo = document.createElement('button');
      lo.className = 'btn btn-ghost btn-sm';
      lo.textContent = 'Salir';
      lo.onclick = doLogout;
      el.appendChild(lo);
    } else {
      const li = document.createElement('button');
      li.className = 'btn btn-outline btn-sm';
      li.textContent = 'Iniciar sesión';
      li.onclick = () => openLoginModal(null);
      el.appendChild(li);
    }
  };
  ['nav-actions-home','nav-actions-booking','nav-actions-client','nav-actions-barber'].forEach(actions);
}

// ===== HOME =====
function renderHome() {
  renderNav();
  const grid = document.getElementById('barbers-grid');
  grid.innerHTML = '';
  STATE.barbers.forEach(b => {
    const card = document.createElement('div');
    card.className = 'barber-card';
    card.onclick = () => startBooking(b.id);

    const today = new Date();
    const nextAvail = (() => {
      for (let i = 0; i < 30; i++) {
        const d = new Date(today); d.setDate(d.getDate() + i);
        if (isBarberAvailable(b.id, fmtDate(d))) {
          return i === 0 ? 'Disponible hoy' : i === 1 ? 'Disponible mañana' : `Próx. ${DAYS_FULL[d.getDay()]}`;
        }
      }
      return 'Sin disponibilidad';
    })();

    card.innerHTML = `
      <div class="barber-avatar">${b.name[0]}</div>
      <div class="barber-name">${b.name}</div>
      <div class="barber-schedule">${nextAvail}</div>
      <div class="barber-days">${DAYS.map((d,i)=>`<span class="day-chip ${b.defaultDays.includes(i)?'active':''}">${d}</span>`).join('')}</div>
      <button class="btn btn-outline" style="width:100%;pointer-events:none">Ver disponibilidad →</button>
    `;
    grid.appendChild(card);
  });
}

// ===== BOOKING =====
function startBooking(barberId) {
  const today = new Date();
  BOOKING = {
    barberId,
    calYear: today.getFullYear(),
    calMonth: today.getMonth(),
    selectedDate: null,
    selectedTime: null,
  };
  showScreen('booking');
}

function renderBooking() {
  renderNav();
  const barber = STATE.barbers.find(b => b.id === BOOKING.barberId);
  if (!barber) return;

  document.getElementById('booking-barber-header').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px">
      <div class="barber-avatar" style="width:50px;height:50px;font-size:20px;margin-bottom:0">${barber.name[0]}</div>
      <div>
        <h2 style="font-size:22px">${barber.name}</h2>
        <div style="font-size:13px;color:var(--fg-3)">${barber.hours.start} – ${barber.hours.end} · cortes de ${barber.slotMinutes} min</div>
      </div>
    </div>
  `;

  renderCalendar();
  updateSummary();
}

function renderCalendar() {
  const labelsEl = document.getElementById('cal-labels');
  const gridEl = document.getElementById('cal-grid');
  const monthLabel = document.getElementById('cal-month-label');

  labelsEl.innerHTML = DAYS.map(d => `<div class="cal-label">${d}</div>`).join('');
  monthLabel.textContent = `${MONTHS[BOOKING.calMonth]} ${BOOKING.calYear}`;

  const first = new Date(BOOKING.calYear, BOOKING.calMonth, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(BOOKING.calYear, BOOKING.calMonth+1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);

  gridEl.innerHTML = '';
  for (let i = 0; i < startDow; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty';
    gridEl.appendChild(el);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(BOOKING.calYear, BOOKING.calMonth, day);
    d.setHours(0,0,0,0);
    const dateStr = fmtDate(d);
    const avail = isBarberAvailable(BOOKING.barberId, dateStr);
    const isPast = d < today;
    const isToday = d.getTime() === today.getTime();
    const isSel = dateStr === BOOKING.selectedDate;

    const el = document.createElement('div');
    el.className = 'cal-day' + (isPast || !avail ? ' disabled' : ' available') + (isSel ? ' selected' : '') + (isToday ? ' today' : '');
    el.textContent = day;

    if (!isPast && avail) {
      el.onclick = () => selectDate(dateStr);
    }
    gridEl.appendChild(el);
  }

  const now = new Date();
  document.getElementById('cal-prev').disabled =
    BOOKING.calYear < now.getFullYear() || (BOOKING.calYear === now.getFullYear() && BOOKING.calMonth <= now.getMonth());
}

function calNav(dir) {
  let m = BOOKING.calMonth + dir;
  let y = BOOKING.calYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  BOOKING.calMonth = m; BOOKING.calYear = y;
  renderCalendar();
}

function selectDate(dateStr) {
  BOOKING.selectedDate = dateStr;
  BOOKING.selectedTime = null;
  renderCalendar();
  renderSlots();
  updateSummary();
}

function renderSlots() {
  const barber = STATE.barbers.find(b => b.id === BOOKING.barberId);
  const container = document.getElementById('slots-container');
  const grid = document.getElementById('slots-grid');
  const label = document.getElementById('slots-date-label');

  if (!BOOKING.selectedDate) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  label.textContent = fmtDisplayDate(parseDate(BOOKING.selectedDate));

  const slots = generateSlots(barber, BOOKING.selectedDate);
  grid.innerHTML = '';
  if (slots.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--fg-3);font-size:13px;padding:16px">Sin horarios disponibles</div>';
    return;
  }
  slots.forEach(slot => {
    const el = document.createElement('div');
    el.className = 'time-slot' + (slot.booked ? ' booked' : '') + (slot.time === BOOKING.selectedTime ? ' selected' : '');
    el.textContent = slot.time;
    if (!slot.booked) el.onclick = () => selectTime(slot.time);
    grid.appendChild(el);
  });
}

function selectTime(time) {
  BOOKING.selectedTime = time;
  renderSlots();
  updateSummary();
}

function updateSummary() {
  const barber = STATE.barbers.find(b => b.id === BOOKING.barberId);
  document.getElementById('s-barber').textContent = barber ? barber.name : '—';
  document.getElementById('s-date').textContent = BOOKING.selectedDate ? fmtDisplayDate(parseDate(BOOKING.selectedDate)) : '—';
  document.getElementById('s-time').textContent = BOOKING.selectedTime || '—';
  document.getElementById('btn-confirm-booking').disabled = !(BOOKING.selectedDate && BOOKING.selectedTime);
}

function openConfirmModal() {
  if (!BOOKING.selectedDate || !BOOKING.selectedTime) return;
  const barber = STATE.barbers.find(b => b.id === BOOKING.barberId);
  const isLoggedIn = STATE.currentUser && STATE.currentUser.role === 'client';

  document.getElementById('confirm-client-fields').style.display = isLoggedIn ? 'none' : 'block';
  document.getElementById('confirm-summary').innerHTML = `
    <div class="card" style="background:var(--accent-soft);border-color:rgba(201,168,76,0.2)">
      <div class="summary-row"><span class="summary-label">Barbero</span><span class="summary-value">${barber.name}</span></div>
      <div class="summary-row"><span class="summary-label">Fecha</span><span class="summary-value">${fmtDisplayDate(parseDate(BOOKING.selectedDate))}</span></div>
      <div class="summary-row"><span class="summary-label">Hora</span><span class="summary-value">${BOOKING.selectedTime}</span></div>
    </div>
  `;
  openModal('modal-confirm');
}

function doBook() {
  const user = STATE.currentUser;
  let clientName, clientEmail, clientId;
  if (user && user.role === 'client') {
    clientName = user.name; clientEmail = user.email; clientId = user.id;
  } else {
    clientName = document.getElementById('guest-name').value.trim();
    clientEmail = document.getElementById('guest-email').value.trim();
    if (!clientName || !clientEmail) { toast('Por favor completa tu nombre y correo'); return; }
    clientId = 'guest_' + Date.now();
  }

  const booking = {
    id: 'bk_' + Date.now(),
    barberId: BOOKING.barberId,
    clientId, clientName, clientEmail,
    date: BOOKING.selectedDate,
    time: BOOKING.selectedTime,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  STATE.bookings.push(booking);
  saveState();
  closeModal('modal-confirm');
  toast('✅ ¡Reserva confirmada!');

  if (!user) {
    const newUser = { id: clientId, name: clientName, email: clientEmail, role: 'client' };
    STATE.currentUser = newUser;
    saveState();
  }

  setTimeout(() => showScreen('client'), 800);
}

// ===== CLIENTE =====
function renderClient() {
  renderNav();
  const user = STATE.currentUser;
  document.getElementById('client-welcome').textContent = user ? `Hola, ${user.name}` : 'Mis reservas';

  const now = new Date(); now.setHours(0,0,0,0);
  const myBookings = STATE.bookings.filter(b =>
    b.clientId === user?.id || b.clientEmail === user?.email
  );

  renderClientAppts(myBookings, now);
}

function clientTab(tab) {
  CLIENT_TAB = tab;
  document.querySelectorAll('#screen-client .tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0&&tab==='upcoming')||(i===1&&tab==='past'));
  });
  const user = STATE.currentUser;
  const now = new Date(); now.setHours(0,0,0,0);
  const myBookings = STATE.bookings.filter(b => b.clientId === user?.id || b.clientEmail === user?.email);
  renderClientAppts(myBookings, now);
}

function renderClientAppts(bookings, now) {
  const container = document.getElementById('client-appointments');
  const upcoming = bookings.filter(b => {
    const d = parseDate(b.date); d.setHours(0,0,0,0);
    return d >= now && b.status !== 'cancelled';
  }).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const past = bookings.filter(b => {
    const d = parseDate(b.date); d.setHours(0,0,0,0);
    return d < now || b.status === 'cancelled';
  }).sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const list = CLIENT_TAB === 'upcoming' ? upcoming : past;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✂️</div><p>${CLIENT_TAB==='upcoming'?'No tienes próximas reservas.':'No hay historial de reservas.'}</p></div>`;
    return;
  }

  container.innerHTML = list.map(b => {
    const barber = STATE.barbers.find(ba => ba.id === b.barberId);
    const d = parseDate(b.date);
    const m = MONTHS[d.getMonth()].slice(0,3).toUpperCase();
    const isPast = d < now;
    const statusBadge = b.status === 'cancelled'
      ? '<span class="badge badge-danger">Cancelada</span>'
      : isPast ? '<span class="badge">Completada</span>'
      : '<span class="badge badge-success">Confirmada</span>';
    return `
      <div class="client-appt-card">
        <div class="client-appt-date">
          <div class="appt-day-num">${d.getDate()}</div>
          <div class="appt-month">${m}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:600;font-size:15px">${b.time}</span>
            ${statusBadge}
          </div>
          <div style="font-size:14px;margin-top:4px">${barber?.name || 'Barbero'}</div>
          <div style="font-size:12px;color:var(--fg-3)">${DAYS_FULL[d.getDay()]}</div>
        </div>
        ${!isPast && b.status !== 'cancelled' ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="cancelBooking('${b.id}')">Cancelar</button>` : ''}
      </div>
    `;
  }).join('');
}

function cancelBooking(id) {
  const b = STATE.bookings.find(x => x.id === id);
  if (!b) return;
  b.status = 'cancelled';
  saveState();
  toast('Reserva cancelada');
  renderClient();
}

// ===== BARBERO =====
function renderBarber() {
  renderNav();
  if (!STATE.currentUser || STATE.currentUser.role !== 'barber') return;
  const barber = STATE.barbers.find(b => b.id === STATE.currentUser.barberId);
  if (!barber) return;
  document.getElementById('barber-welcome').textContent = barber.name;
  renderBarberTab(BARBER_TAB);
  document.querySelectorAll('#screen-barber .tab').forEach((t,i) => {
    t.classList.toggle('active', (['agenda','schedule','overrides'][i]) === BARBER_TAB);
  });
}

function barberTab(tab) {
  BARBER_TAB = tab;
  document.querySelectorAll('#screen-barber .tab').forEach((t,i) => {
    t.classList.toggle('active', (['agenda','schedule','overrides'][i]) === BARBER_TAB);
  });
  renderBarberTab(tab);
}

function renderBarberTab(tab) {
  const barber = STATE.barbers.find(b => b.id === STATE.currentUser?.barberId);
  if (!barber) return;
  const container = document.getElementById('barber-panel-content');

  if (tab === 'agenda') {
    const today = new Date(); today.setHours(0,0,0,0);
    const upcoming = STATE.bookings.filter(b => {
      if (b.barberId !== barber.id || b.status === 'cancelled') return false;
      const d = parseDate(b.date); d.setHours(0,0,0,0);
      return d >= today;
    }).sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

    const grouped = {};
    upcoming.forEach(b => {
      if (!grouped[b.date]) grouped[b.date] = [];
      grouped[b.date].push(b);
    });

    if (Object.keys(grouped).length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p>No tienes reservas próximas.</p></div>`;
      return;
    }

    container.innerHTML = Object.entries(grouped).map(([date, appts]) => {
      const d = parseDate(date);
      return `
        <div style="margin-bottom:20px">
          <div style="font-weight:600;margin-bottom:8px;color:var(--fg-2);font-size:13px;text-transform:uppercase;letter-spacing:0.06em">
            ${DAYS_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}
          </div>
          <div class="appointments-list">
            ${appts.map(a => `
              <div class="appt-row">
                <div class="appt-time">${a.time}</div>
                <div class="appt-info">
                  <div class="appt-client">${a.clientName}</div>
                  <div class="appt-date">${a.clientEmail}</div>
                </div>
                <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="barberCancelBooking('${a.id}')">Cancelar</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

  } else if (tab === 'schedule') {
    container.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <h3 style="margin-bottom:4px">Días de trabajo regulares</h3>
        <p style="font-size:13px;color:var(--fg-3);margin-bottom:16px">Activa los días en que normalmente trabajas</p>
        <div class="day-toggle-grid" id="day-toggles"></div>
      </div>
      <div class="card">
        <h3 style="margin-bottom:4px">Horario</h3>
        <p style="font-size:13px;color:var(--fg-3);margin-bottom:16px">Hora de inicio y fin del día</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Desde</label>
            <input class="form-input" type="time" id="hour-start" value="${barber.hours.start}">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Hasta</label>
            <input class="form-input" type="time" id="hour-end" value="${barber.hours.end}">
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Duración del turno</label>
          <select class="form-input" id="slot-minutes">
            <option value="20" ${barber.slotMinutes===20?'selected':''}>20 minutos</option>
            <option value="30" ${barber.slotMinutes===30?'selected':''}>30 minutos</option>
            <option value="45" ${barber.slotMinutes===45?'selected':''}>45 minutos</option>
            <option value="60" ${barber.slotMinutes===60?'selected':''}>60 minutos</option>
          </select>
        </div>
        <button class="btn btn-primary" style="margin-top:16px;width:100%" onclick="saveSchedule()">Guardar horario</button>
      </div>
    `;

    const toggleGrid = document.getElementById('day-toggles');
    DAYS.forEach((d, i) => {
      const el = document.createElement('div');
      const isOn = barber.defaultDays.includes(i);
      el.className = `day-toggle ${isOn?'on':''}`;
      el.innerHTML = `<div>${d}</div>`;
      el.onclick = () => {
        const idx = barber.defaultDays.indexOf(i);
        if (idx >= 0) barber.defaultDays.splice(idx, 1);
        else barber.defaultDays.push(i);
        el.classList.toggle('on', barber.defaultDays.includes(i));
        el.classList.toggle('off', !barber.defaultDays.includes(i));
        saveState();
      };
      toggleGrid.appendChild(el);
    });

  } else if (tab === 'overrides') {
    const ovs = STATE.overrides[barber.id] || [];
    const today = new Date(); today.setHours(0,0,0,0);
    const futureOvs = ovs.filter(o => parseDate(o.date) >= today).sort((a,b) => a.date.localeCompare(b.date));

    container.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <h3 style="margin-bottom:4px">Días especiales</h3>
            <p style="font-size:13px;color:var(--fg-3)">Marca días donde tu disponibilidad cambia</p>
          </div>
          <button class="btn btn-outline btn-sm" onclick="openModal('modal-override')">+ Añadir</button>
        </div>
        <div id="override-list">
          ${futureOvs.length === 0
            ? `<div class="empty-state" style="padding:24px 0"><div class="empty-state-icon">📆</div><p>No hay días especiales registrados.</p></div>`
            : futureOvs.map(o => {
              const d = parseDate(o.date);
              return `
                <div class="override-item">
                  <span>${DAYS_FULL[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}</span>
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="badge ${o.available ? 'badge-success' : 'badge-danger'}">${o.available ? '✓ Disponible' : '✗ No disponible'}</span>
                    <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--fg-3)" onclick="removeOverride('${o.date}')">✕</button>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    `;
  }
}

function saveSchedule() {
  const barber = STATE.barbers.find(b => b.id === STATE.currentUser?.barberId);
  if (!barber) return;
  barber.hours.start = document.getElementById('hour-start').value;
  barber.hours.end = document.getElementById('hour-end').value;
  barber.slotMinutes = parseInt(document.getElementById('slot-minutes').value);
  saveState();
  toast('✅ Horario guardado');
}

function barberCancelBooking(id) {
  const b = STATE.bookings.find(x => x.id === id);
  if (!b) return;
  b.status = 'cancelled';
  saveState();
  toast('Reserva cancelada');
  renderBarberTab(BARBER_TAB);
}

function doAddOverride() {
  const barber = STATE.barbers.find(b => b.id === STATE.currentUser?.barberId);
  if (!barber) return;
  const date = document.getElementById('ov-date').value;
  if (!date) { toast('Selecciona una fecha'); return; }
  const statusVal = document.querySelector('input[name="ov-status"]:checked').value;
  const available = statusVal === 'available';

  if (!STATE.overrides[barber.id]) STATE.overrides[barber.id] = [];
  STATE.overrides[barber.id] = STATE.overrides[barber.id].filter(o => o.date !== date);
  STATE.overrides[barber.id].push({ date, available });
  saveState();
  closeModal('modal-override');
  toast(available ? '✅ Día extra añadido' : '✅ Día marcado como no disponible');
  renderBarberTab('overrides');
}

function removeOverride(date) {
  const barber = STATE.barbers.find(b => b.id === STATE.currentUser?.barberId);
  if (!barber) return;
  STATE.overrides[barber.id] = (STATE.overrides[barber.id] || []).filter(o => o.date !== date);
  saveState();
  renderBarberTab('overrides');
}

// ===== AUTH =====
function loginTab(role) {
  loginRole = role;
  document.querySelectorAll('#modal-login .tab').forEach((t,i) => t.classList.toggle('active', i===(role==='client'?0:1)));
  document.getElementById('login-form-client').style.display = role === 'client' ? 'block' : 'none';
  document.getElementById('login-form-barber').style.display = role === 'barber' ? 'block' : 'none';
}

function openLoginModal(target) {
  LOGIN_TARGET = target;
  loginTab('client');
  openModal('modal-login');
}

function doLogin() {
  if (loginRole === 'client') {
    const name = document.getElementById('lc-name').value.trim();
    const email = document.getElementById('lc-email').value.trim();
    if (!name || !email) { toast('Por favor ingresa nombre y correo'); return; }
    const user = { id: 'c_' + Date.now(), name, email, role: 'client' };
    STATE.currentUser = user;
    saveState();
    closeModal('modal-login');
    renderNav();
    toast(`Bienvenido, ${name}!`);
    if (LOGIN_TARGET === 'booking') openConfirmModal();
    else showScreen('client');
  } else {
    const email = document.getElementById('lb-email').value.trim().toLowerCase();
    const barber = STATE.barbers.find(b => b.email.toLowerCase() === email);
    if (!barber) { toast('Correo no registrado como barbero'); return; }
    const user = { id: 'b_' + barber.id, name: barber.name, email: barber.email, role: 'barber', barberId: barber.id };
    STATE.currentUser = user;
    saveState();
    closeModal('modal-login');
    showScreen('barber');
  }
}

function doLogout() {
  STATE.currentUser = null;
  try { localStorage.removeItem('barberbook_user'); } catch(e) {}
  saveState();
  showScreen('home');
}

// ===== MODALES =====
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
  });

  showScreen('home');
});
