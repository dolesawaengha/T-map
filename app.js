/* เที่ยวแสวงหา - ฝั่งหน้าเว็บ (HTML/CSS/JS ล้วน + Google Apps Script) */

// ใส่ Web app URL ที่ได้จาก Apps Script (ลงท้ายด้วย /exec)
const API_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

const $app = document.getElementById('app');
const params = new URLSearchParams(location.search);

/* ---------- ตัวช่วย ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function safeUrl(u) {
  u = String(u || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}
async function api(action, data, auth) {
  if (API_URL.indexOf('PASTE_') === 0) throw new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ app.js');
  const body = Object.assign({ action: action }, data || {});
  if (auth) body.token = sessionStorage.getItem('token') || '';
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // ไม่ทำให้เกิด CORS preflight
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!json.ok) {
    if (auth && /เข้าสู่ระบบ/.test(json.error)) { sessionStorage.removeItem('token'); }
    throw new Error(json.error);
  }
  return json.data;
}
function showMsg(el, text, ok) {
  el.innerHTML = '<div class="msg ' + (ok ? 'ok' : 'err') + '">' + esc(text) + '</div>';
}
function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fail(e) { $app.innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; }

/* ---------- Router ---------- */
function route() {
  const admin = params.get('admin');
  if (params.get('quiz')) return quizPage(params.get('quiz'));
  if (params.get('member') === 'certificates') return certPage();
  if (params.get('page') === 'login') return loginPage();
  if (admin) return adminPage(admin);
  return homePage();
}
route();

/* =========================================================
   หน้าแรก
   ========================================================= */
async function homePage() {
  try {
    const r = await Promise.all([api('getHome'), api('getPlaces'), api('getQuizzes')]);
    const home = r[0], places = r[1], quizzes = r[2];
    const bg = safeUrl(home.heroImage)
      ? 'style="background-image:linear-gradient(rgba(23,64,47,.55),rgba(23,64,47,.55)),url(\'' + esc(safeUrl(home.heroImage)) + '\')"' : '';
    $app.innerHTML =
      '<div class="hero" ' + bg + '><h1>' + esc(home.heroTitle) + '</h1><p>' + esc(home.heroSubtitle) + '</p>' +
      '<div class="actions"><a class="btn light" href="#places">ดูที่เที่ยว</a><a class="btn light" href="#quizzes">ทำแบบทดสอบ</a></div></div>' +
      '<section><h2>' + esc(home.aboutTitle) + '</h2><p>' + esc(home.aboutText) + '</p></section>' +
      '<section id="places"><h2>ที่เที่ยวและแหล่งเรียนรู้</h2><div class="grid">' +
      (places.length ? places.map(placeCard).join('') : '<p class="muted">ยังไม่มีข้อมูลสถานที่</p>') + '</div></section>' +
      '<section id="quizzes"><h2>แบบทดสอบความรู้</h2><div class="grid">' +
      (quizzes.length ? quizzes.map(quizCard).join('') : '<p class="muted">ยังไม่มีแบบทดสอบ</p>') + '</div>' +
      '<p><a href="./?member=certificates">ดูเกียรติบัตรของฉัน &raquo;</a></p></section>';
    if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
  } catch (e) { fail(e); }
}
function placeCard(p) {
  const img = safeUrl(p.image) ? 'style="background-image:url(\'' + esc(safeUrl(p.image)) + '\')"' : '';
  const map = safeUrl(p.mapUrl) ? '<a href="' + esc(safeUrl(p.mapUrl)) + '" target="_blank" rel="noopener">ดูแผนที่</a>' : '';
  return '<article class="card"><div class="thumb" ' + img + '></div><div class="body">' +
    (p.category ? '<span class="tag">' + esc(p.category) + '</span>' : '') +
    '<h3>' + esc(p.name) + '</h3><p>' + esc(p.description) + '</p>' + map + '</div></article>';
}
function quizCard(q) {
  return '<article class="card"><div class="body"><h3>' + esc(q.title) + '</h3><p class="muted">' + esc(q.description) +
    '</p><p>' + esc(q.questionCount) + ' ข้อ · ผ่านเกณฑ์ ' + esc(q.passPercent) + '%</p>' +
    '<a class="btn" href="./?quiz=' + encodeURIComponent(q.id) + '">เริ่มทำแบบทดสอบ</a></div></article>';
}

/* =========================================================
   ทำแบบทดสอบ  /?quiz=ID
   ========================================================= */
async function quizPage(id) {
  try {
    const quiz = await api('getQuiz', { quizId: id });
    $app.innerHTML =
      '<h2>' + esc(quiz.title) + '</h2><p class="muted">' + esc(quiz.description) + '</p>' +
      '<form class="box" id="infoForm"><h3>ข้อมูลผู้ทำแบบทดสอบ</h3>' +
      '<label>ชื่อ-นามสกุล</label><input name="name" required>' +
      '<label>โรงเรียน / หน่วยงาน</label><input name="school">' +
      '<label>เบอร์โทร (ใช้ค้นเกียรติบัตร)</label><input name="phone" required inputmode="tel">' +
      '<p><button class="btn" type="submit">เริ่มทำข้อสอบ</button></p></form><div id="quizArea"></div>';
    document.getElementById('infoForm').onsubmit = function (ev) {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const info = { name: f.get('name').trim(), school: f.get('school').trim(), phone: f.get('phone').trim() };
      ev.target.style.display = 'none';
      renderQuestions(quiz, info);
    };
  } catch (e) { fail(e); }
}
function renderQuestions(quiz, info) {
  const area = document.getElementById('quizArea');
  area.innerHTML = '<form id="qForm">' + quiz.questions.map(function (q, i) {
    return '<div class="question" data-id="' + esc(q.id) + '"><div class="q">' + (i + 1) + '. ' + esc(q.question) + '</div>' +
      ['A', 'B', 'C', 'D'].map(function (L) {
        const t = q['choice' + L];
        return t ? '<label class="choice" data-l="' + L + '"><input type="radio" name="' + esc(q.id) + '" value="' + L + '"> ' + L + '. ' + esc(t) + '</label>' : '';
      }).join('') + '</div>';
  }).join('') + '<p><button class="btn" type="submit">ส่งคำตอบ</button></p><div id="qMsg"></div></form>';

  document.getElementById('qForm').onsubmit = async function (ev) {
    ev.preventDefault();
    const answers = {};
    quiz.questions.forEach(function (q) {
      const c = ev.target.querySelector('input[name="' + q.id + '"]:checked');
      if (c) answers[q.id] = c.value;
    });
    if (Object.keys(answers).length < quiz.questions.length && !confirm('ยังตอบไม่ครบทุกข้อ ต้องการส่งเลยหรือไม่?')) return;
    const btn = ev.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'กำลังตรวจ...';
    try {
      const r = await api('submitQuiz', Object.assign({ quizId: quiz.id, answers: answers }, info));
      showResult(quiz, info, r);
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ส่งคำตอบ';
      showMsg(document.getElementById('qMsg'), e.message);
    }
  };
}
function showResult(quiz, info, r) {
  const area = document.getElementById('quizArea');
  area.innerHTML =
    '<div class="box"><div class="score">' + r.score + ' / ' + r.total + '</div>' +
    '<p style="text-align:center">คิดเป็น ' + r.percent + '% — ' + (r.passed ? '<b>ผ่านเกณฑ์ 🎉</b>' : 'ยังไม่ผ่านเกณฑ์ ลองใหม่อีกครั้งนะ') + '</p>' +
    '<p style="text-align:center">' +
    (r.passed ? '<a class="btn" href="./?member=certificates">รับเกียรติบัตร</a> ' : '<a class="btn" href="./?quiz=' + encodeURIComponent(quiz.id) + '">ทำอีกครั้ง</a> ') +
    '<a class="btn ghost" href="./">กลับหน้าแรก</a></p></div><h3>เฉลย</h3>' +
    quiz.questions.map(function (q, i) {
      const rv = r.review.find(function (x) { return x.id === q.id; }) || {};
      return '<div class="question"><div class="q">' + (i + 1) + '. ' + esc(q.question) + '</div>' +
        ['A', 'B', 'C', 'D'].map(function (L) {
          const t = q['choice' + L];
          if (!t) return '';
          const cls = L === rv.answer ? 'right' : (L === rv.yours ? 'wrong' : '');
          return '<div class="choice ' + cls + '">' + L + '. ' + esc(t) + '</div>';
        }).join('') + '</div>';
    }).join('');
  window.scrollTo(0, 0);
}

/* =========================================================
   เกียรติบัตร  /?member=certificates
   ========================================================= */
function certPage() {
  $app.innerHTML =
    '<h2 class="no-print">เกียรติบัตรของฉัน</h2>' +
    '<form class="box no-print" id="certForm"><p class="muted">กรอกชื่อและเบอร์โทรเดียวกับที่ใช้ทำแบบทดสอบ</p>' +
    '<label>ชื่อ-นามสกุล</label><input name="name" required>' +
    '<label>เบอร์โทร</label><input name="phone" required inputmode="tel">' +
    '<p><button class="btn" type="submit">ค้นหา</button></p></form><div id="certArea"></div>';
  document.getElementById('certForm').onsubmit = async function (ev) {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const area = document.getElementById('certArea');
    area.innerHTML = '<p class="loading">กำลังค้นหา...</p>';
    try {
      const r = await api('getCertificates', { name: f.get('name'), phone: f.get('phone') });
      if (!r.certificates.length) { area.innerHTML = '<div class="msg err no-print">ไม่พบเกียรติบัตร (ต้องสอบผ่านเกณฑ์ก่อน)</div>'; return; }
      area.innerHTML = r.certificates.map(function (c, i) {
        return '<div class="no-print row" style="margin:12px 0"><b>' + esc(c.quizTitle) + '</b> <span class="muted">' + esc(c.percent) + '% · ' +
          fmtDate(c.createdAt) + '</span> <button class="btn small" data-i="' + i + '">ดู / พิมพ์</button></div>';
      }).join('') + '<div id="certView"></div>';
      area.querySelectorAll('button[data-i]').forEach(function (b) {
        b.onclick = function () {
          const c = r.certificates[Number(b.dataset.i)];
          document.getElementById('certView').innerHTML =
            '<div class="certificate"><h1>เกียรติบัตร</h1><p>มอบให้ไว้เพื่อแสดงว่า</p>' +
            '<div class="name">' + esc(r.member.name) + '</div>' +
            (r.member.school ? '<p>' + esc(r.member.school) + '</p>' : '') +
            '<p>ผ่านการทดสอบความรู้ "' + esc(c.quizTitle) + '"<br>ด้วยคะแนน ' + esc(c.score) + ' / ' + esc(c.total) + ' (' + esc(c.percent) + '%)</p>' +
            '<p>' + esc(r.org) + '<br>ให้ไว้ ณ วันที่ ' + fmtDate(c.createdAt) + '</p></div>' +
            '<p class="no-print" style="text-align:center"><button class="btn" onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></p>';
          document.getElementById('certView').scrollIntoView();
        };
      });
    } catch (e) { area.innerHTML = ''; showMsg(area, e.message); }
  };
}

/* =========================================================
   เข้าสู่ระบบผู้ดูแล  /?page=login
   ========================================================= */
function loginPage() {
  $app.innerHTML =
    '<h2>เข้าสู่ระบบผู้ดูแล</h2><form class="box" id="loginForm"><label>รหัสผ่าน</label>' +
    '<input type="password" name="password" required autocomplete="current-password">' +
    '<p><button class="btn" type="submit">เข้าสู่ระบบ</button></p><div id="loginMsg"></div></form>';
  document.getElementById('loginForm').onsubmit = async function (ev) {
    ev.preventDefault();
    try {
      const r = await api('login', { password: new FormData(ev.target).get('password') });
      sessionStorage.setItem('token', r.token);
      location.href = './?admin=home';
    } catch (e) { showMsg(document.getElementById('loginMsg'), e.message); }
  };
}

/* =========================================================
   หลังบ้านผู้ดูแล  /?admin=places|members|quizzes|home|security
   ========================================================= */
const ADMIN_TABS = [
  ['places', 'จัดการสถานที่'], ['members', 'ข้อมูลสมาชิก'], ['quizzes', 'จัดการแบบทดสอบ'],
  ['home', 'จัดการหน้าแรก'], ['security', 'เปลี่ยนรหัสผ่าน']
];
function adminPage(tab) {
  if (!sessionStorage.getItem('token')) { location.href = './?page=login'; return; }
  $app.innerHTML =
    '<div class="admin-nav no-print">' + ADMIN_TABS.map(function (t) {
      return '<a href="./?admin=' + t[0] + '" class="' + (t[0] === tab ? 'active' : '') + '">' + t[1] + '</a>';
    }).join('') + '<a href="#" id="logout">ออกจากระบบ</a></div><div id="adminBody"><p class="loading">กำลังโหลด...</p></div>';
  document.getElementById('logout').onclick = function (e) {
    e.preventDefault(); sessionStorage.removeItem('token'); location.href = './';
  };
  const fn = { places: adminPlaces, members: adminMembers, quizzes: adminQuizzes, home: adminHome, security: adminSecurity }[tab];
  if (!fn) { fail(new Error('ไม่พบหน้านี้')); return; }
  fn(document.getElementById('adminBody')).catch(function (e) {
    if (!sessionStorage.getItem('token')) { location.href = './?page=login'; return; }
    document.getElementById('adminBody').innerHTML = '<div class="msg err">' + esc(e.message) + '</div>';
  });
}

/* ---- จัดการหน้าแรก ---- */
async function adminHome(el) {
  const h = await api('getHome');
  const fields = [
    ['heroTitle', 'หัวข้อหลัก'], ['heroSubtitle', 'คำบรรยายใต้หัวข้อ'], ['heroImage', 'ลิงก์รูปพื้นหลัง (https://...)'],
    ['aboutTitle', 'หัวข้อแนะนำ'], ['aboutText', 'ข้อความแนะนำ'], ['certificateOrg', 'ชื่อหน่วยงานบนเกียรติบัตร']
  ];
  el.innerHTML = '<h2>จัดการหน้าแรก</h2><form class="box" id="homeForm">' + fields.map(function (f) {
    const long = f[0] === 'aboutText';
    return '<label>' + f[1] + '</label>' + (long
      ? '<textarea name="' + f[0] + '">' + esc(h[f[0]]) + '</textarea>'
      : '<input name="' + f[0] + '" value="' + esc(h[f[0]]) + '">');
  }).join('') + '<p><button class="btn" type="submit">บันทึก</button></p><div id="hMsg"></div></form>';
  document.getElementById('homeForm').onsubmit = async function (ev) {
    ev.preventDefault();
    const values = {};
    new FormData(ev.target).forEach(function (v, k) { values[k] = v; });
    try { await api('saveHome', { values: values }, true); showMsg(document.getElementById('hMsg'), 'บันทึกแล้ว', true); }
    catch (e) { showMsg(document.getElementById('hMsg'), e.message); }
  };
}

/* ---- จัดการสถานที่ ---- */
async function adminPlaces(el) {
  const places = await api('getPlaces');
  el.innerHTML = '<h2>จัดการสถานที่</h2><div class="box" style="max-width:none"><div id="plMsg"></div>' +
    '<form id="plForm"><input type="hidden" name="id">' +
    '<div class="row"><div style="flex:2;min-width:200px"><label>ชื่อสถานที่</label><input name="name" required></div>' +
    '<div style="flex:1;min-width:140px"><label>หมวดหมู่</label><input name="category"></div>' +
    '<div style="width:90px"><label>ลำดับ</label><input name="order" type="number" value="1"></div></div>' +
    '<label>รายละเอียด</label><textarea name="description"></textarea>' +
    '<label>ลิงก์รูปภาพ (https://...)</label><input name="image">' +
    '<label>ลิงก์แผนที่ (https://...)</label><input name="mapUrl">' +
    '<p><button class="btn" type="submit">บันทึกสถานที่</button> <button class="btn ghost" type="reset">ล้างฟอร์ม</button></p></form></div>' +
    '<div class="table-wrap" style="margin-top:20px"><table><tr><th>ลำดับ</th><th>ชื่อ</th><th>หมวด</th><th></th></tr>' +
    places.map(function (p, i) {
      return '<tr><td>' + esc(p.order) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.category) + '</td><td>' +
        '<button class="btn small ghost" data-e="' + i + '">แก้ไข</button> <button class="btn small danger" data-d="' + i + '">ลบ</button></td></tr>';
    }).join('') + '</table></div>';
  const form = document.getElementById('plForm');
  form.onsubmit = async function (ev) {
    ev.preventDefault();
    const place = {};
    new FormData(form).forEach(function (v, k) { place[k] = v; });
    try { await api('savePlace', { place: place }, true); adminPage('places'); }
    catch (e) { showMsg(document.getElementById('plMsg'), e.message); }
  };
  el.querySelectorAll('[data-e]').forEach(function (b) {
    b.onclick = function () {
      const p = places[Number(b.dataset.e)];
      Object.keys(p).forEach(function (k) { if (form.elements[k]) form.elements[k].value = p[k]; });
      form.scrollIntoView();
    };
  });
  el.querySelectorAll('[data-d]').forEach(function (b) {
    b.onclick = async function () {
      const p = places[Number(b.dataset.d)];
      if (!confirm('ลบ "' + p.name + '" ?')) return;
      try { await api('deletePlace', { id: p.id }, true); adminPage('places'); }
      catch (e) { showMsg(document.getElementById('plMsg'), e.message); }
    };
  });
}

/* ---- ข้อมูลสมาชิก ---- */
async function adminMembers(el) {
  const r = await api('getMembers', {}, true);
  el.innerHTML = '<h2>ข้อมูลสมาชิก (' + r.members.length + ')</h2><div id="mMsg"></div><div class="table-wrap"><table>' +
    '<tr><th>ชื่อ</th><th>โรงเรียน/หน่วยงาน</th><th>เบอร์โทร</th><th>ผลสอบ</th><th></th></tr>' +
    r.members.map(function (m, i) {
      const rs = r.results.filter(function (x) { return String(x.memberId) === String(m.id); });
      return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.school) + '</td><td>' + esc(m.phone) + '</td><td>' +
        (rs.map(function (x) { return esc(x.quizTitle) + ': ' + esc(x.percent) + '% ' + (String(x.passed) === 'true' ? '✔' : '✘'); }).join('<br>') || '-') +
        '</td><td><button class="btn small danger" data-d="' + i + '">ลบ</button></td></tr>';
    }).join('') + '</table></div>';
  el.querySelectorAll('[data-d]').forEach(function (b) {
    b.onclick = async function () {
      const m = r.members[Number(b.dataset.d)];
      if (!confirm('ลบสมาชิก "' + m.name + '" และผลสอบทั้งหมด?')) return;
      try { await api('deleteMember', { id: m.id }, true); adminPage('members'); }
      catch (e) { showMsg(document.getElementById('mMsg'), e.message); }
    };
  });
}

/* ---- จัดการแบบทดสอบ ---- */
async function adminQuizzes(el) {
  const quizId = params.get('id');
  if (quizId) return adminQuestions(el, quizId);
  const quizzes = await api('adminGetQuizzes', {}, true);
  el.innerHTML = '<h2>จัดการแบบทดสอบ</h2><div class="box"><div id="qzMsg"></div><form id="qzForm"><input type="hidden" name="id">' +
    '<label>ชื่อแบบทดสอบ</label><input name="title" required>' +
    '<label>คำอธิบาย</label><textarea name="description"></textarea>' +
    '<label>เกณฑ์ผ่าน (%)</label><input name="passPercent" type="number" min="1" max="100" value="60">' +
    '<label>สถานะ</label><select name="active"><option value="true">เปิดให้ทำ</option><option value="false">ปิด</option></select>' +
    '<p><button class="btn" type="submit">บันทึกแบบทดสอบ</button> <button class="btn ghost" type="reset">ล้างฟอร์ม</button></p></form></div>' +
    '<div class="table-wrap" style="margin-top:20px"><table><tr><th>ชื่อ</th><th>เกณฑ์</th><th>สถานะ</th><th></th></tr>' +
    quizzes.map(function (q, i) {
      return '<tr><td>' + esc(q.title) + '</td><td>' + esc(q.passPercent) + '%</td><td>' + (String(q.active) === 'true' ? 'เปิด' : 'ปิด') + '</td><td>' +
        '<a class="btn small" href="./?admin=quizzes&id=' + encodeURIComponent(q.id) + '">จัดการข้อสอบ</a> ' +
        '<button class="btn small ghost" data-e="' + i + '">แก้ไข</button> <button class="btn small danger" data-d="' + i + '">ลบ</button></td></tr>';
    }).join('') + '</table></div>';
  const form = document.getElementById('qzForm');
  form.onsubmit = async function (ev) {
    ev.preventDefault();
    const quiz = {};
    new FormData(form).forEach(function (v, k) { quiz[k] = v; });
    quiz.active = quiz.active === 'true';
    try { await api('saveQuiz', { quiz: quiz }, true); adminPage('quizzes'); }
    catch (e) { showMsg(document.getElementById('qzMsg'), e.message); }
  };
  el.querySelectorAll('[data-e]').forEach(function (b) {
    b.onclick = function () {
      const q = quizzes[Number(b.dataset.e)];
      Object.keys(q).forEach(function (k) { if (form.elements[k]) form.elements[k].value = String(q[k]); });
      form.scrollIntoView();
    };
  });
  el.querySelectorAll('[data-d]').forEach(function (b) {
    b.onclick = async function () {
      const q = quizzes[Number(b.dataset.d)];
      if (!confirm('ลบแบบทดสอบ "' + q.title + '" และข้อสอบทั้งหมด?')) return;
      try { await api('deleteQuiz', { id: q.id }, true); adminPage('quizzes'); }
      catch (e) { showMsg(document.getElementById('qzMsg'), e.message); }
    };
  });
}

async function adminQuestions(el, quizId) {
  const qs = await api('adminGetQuestions', { quizId: quizId }, true);
  el.innerHTML = '<h2>ข้อสอบ</h2><p><a href="./?admin=quizzes">&laquo; กลับไปรายการแบบทดสอบ</a></p>' +
    '<div class="box"><div id="qMsg2"></div><form id="qnForm"><input type="hidden" name="id"><input type="hidden" name="quizId" value="' + esc(quizId) + '">' +
    '<label>คำถาม</label><textarea name="question" required></textarea>' +
    ['A', 'B', 'C', 'D'].map(function (L) { return '<label>ตัวเลือก ' + L + '</label><input name="choice' + L + '"' + (L < 'C' ? ' required' : '') + '>'; }).join('') +
    '<label>คำตอบที่ถูก</label><select name="answer"><option>A</option><option>B</option><option>C</option><option>D</option></select>' +
    '<p><button class="btn" type="submit">บันทึกข้อสอบ</button> <button class="btn ghost" type="reset">ล้างฟอร์ม</button></p></form></div>' +
    '<div class="table-wrap" style="margin-top:20px"><table><tr><th>#</th><th>คำถาม</th><th>เฉลย</th><th></th></tr>' +
    qs.map(function (q, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(q.question) + '</td><td>' + esc(q.answer) + '</td><td>' +
        '<button class="btn small ghost" data-e="' + i + '">แก้ไข</button> <button class="btn small danger" data-d="' + i + '">ลบ</button></td></tr>';
    }).join('') + '</table></div>';
  const form = document.getElementById('qnForm');
  form.onsubmit = async function (ev) {
    ev.preventDefault();
    const question = {};
    new FormData(form).forEach(function (v, k) { question[k] = v; });
    try { await api('saveQuestion', { question: question }, true); adminPage('quizzes'); }
    catch (e) { showMsg(document.getElementById('qMsg2'), e.message); }
  };
  el.querySelectorAll('[data-e]').forEach(function (b) {
    b.onclick = function () {
      const q = qs[Number(b.dataset.e)];
      Object.keys(q).forEach(function (k) { if (form.elements[k]) form.elements[k].value = q[k]; });
      form.scrollIntoView();
    };
  });
  el.querySelectorAll('[data-d]').forEach(function (b) {
    b.onclick = async function () {
      if (!confirm('ลบข้อนี้?')) return;
      try { await api('deleteQuestion', { id: qs[Number(b.dataset.d)].id }, true); adminPage('quizzes'); }
      catch (e) { showMsg(document.getElementById('qMsg2'), e.message); }
    };
  });
}

/* ---- เปลี่ยนรหัสผ่านผู้ดูแล ---- */
async function adminSecurity(el) {
  el.innerHTML = '<h2>เปลี่ยนรหัสผ่านผู้ดูแล</h2><form class="box" id="pwForm">' +
    '<label>รหัสผ่านเดิม</label><input type="password" name="oldPassword" required autocomplete="current-password">' +
    '<label>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label><input type="password" name="newPassword" required minlength="6" autocomplete="new-password">' +
    '<label>ยืนยันรหัสผ่านใหม่</label><input type="password" name="confirm" required minlength="6" autocomplete="new-password">' +
    '<p><button class="btn" type="submit">เปลี่ยนรหัสผ่าน</button></p><div id="pwMsg"></div></form>';
  document.getElementById('pwForm').onsubmit = async function (ev) {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const msg = document.getElementById('pwMsg');
    if (f.get('newPassword') !== f.get('confirm')) { showMsg(msg, 'รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    try {
      await api('changePassword', { oldPassword: f.get('oldPassword'), newPassword: f.get('newPassword') }, true);
      showMsg(msg, 'เปลี่ยนรหัสผ่านแล้ว', true); ev.target.reset();
    } catch (e) { showMsg(msg, e.message); }
  };
}
