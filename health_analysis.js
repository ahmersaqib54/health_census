/*
  health_analysis.js
  - Manages patients (LocalStorage)
  - Provides edit/delete, export CSV, sample data
  - Provides dashboard initialization (Chart.js)
  - Condition lookup via health_analysis.json
*/

const patientForm = document.getElementById('patientForm');
const addPatientBtn = document.getElementById('addPatient');
const clearFormBtn = document.getElementById('clearForm');
const patientTable = document.getElementById('patientTable');
const report = document.getElementById('report');
const searchInput = document.getElementById('searchPatient');
const sortSelect = document.getElementById('sortBy');
const exportCsvBtn = document.getElementById('exportCsv');
const importSampleBtn = document.getElementById('importSample');
const conditionInput = document.getElementById('conditionInput');
const btnSearch = document.getElementById('btnSearch');
const resultDiv = document.getElementById('result');

let patients = JSON.parse(localStorage.getItem('patients') || '[]');

/* ---------- Utilities ---------- */
function savePatients(){ localStorage.setItem('patients', JSON.stringify(patients)); }
function uid(){ return Date.now() + Math.floor(Math.random()*1000); }

/* ---------- CRUD ---------- */
function clearForm(){ patientForm.reset(); document.getElementById('patientId').value = ''; }

function populateTable(list){
  patientTable.innerHTML = '';
  if(!list.length){ patientTable.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#6b7280">No records</td></tr>'; return; }
  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td>${p.gender}</td>
      <td>${p.age}</td>
      <td>${p.condition}</td>
      <td>
        <button class="btn ghost" onclick="editPatient('${p.id}')">Edit</button>
        <button class="btn" style="background:#ea4335;margin-left:6px" onclick="deletePatient('${p.id}')">Delete</button>
      </td>
    `;
    patientTable.appendChild(tr);
  });
}

function generateReport(){
  const total = patients.length;
  const counts = { Diabetes:0, Thyroid:0, 'High Blood Pressure':0 };
  patients.forEach(p=> counts[p.condition] = (counts[p.condition]||0) + 1);
  report.innerHTML = `Total: <strong>${total}</strong><br>
    Diabetes: ${counts.Diabetes} | Thyroid: ${counts.Thyroid} | High BP: ${counts['High Blood Pressure']}`;
}

function addOrUpdatePatient(e){
  e.preventDefault();
  const id = document.getElementById('patientId').value;
  const name = document.getElementById('name').value.trim();
  const gender = document.querySelector('input[name="gender"]:checked');
  const age = document.getElementById('age').value;
  const condition = document.getElementById('condition').value;

  if(!name || !gender || !age || !condition){ alert('Please complete the form'); return; }

  if(id){
    // update
    const idx = patients.findIndex(p=>p.id==id);
    if(idx>-1){ patients[idx] = { ...patients[idx], name, gender:gender.value, age, condition }; }
  } else {
    patients.push({ id: uid().toString(), name, gender:gender.value, age, condition, added: new Date().toISOString() });
  }

  savePatients();
  refreshList();
  clearForm();
}

function editPatient(id){
  const p = patients.find(x=>x.id==id);
  if(!p) return;
  document.getElementById('patientId').value = p.id;
  document.getElementById('name').value = p.name;
  document.querySelector(`input[name=\"gender\"][value=\"${p.gender}\"]`).checked = true;
  document.getElementById('age').value = p.age;
  document.getElementById('condition').value = p.condition;
  window.scrollTo({top:0,behavior:'smooth'});
}

function deletePatient(id){
  if(!confirm('Delete this patient?')) return;
  patients = patients.filter(p=>p.id!=id);
  savePatients();
  refreshList();
}

/* ---------- Sorting / Searching / Export ---------- */
function filteredAndSorted(){
  const q = (searchInput?.value || '').toLowerCase();
  let list = patients.filter(p => p.name.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q));
  const sortBy = sortSelect?.value;
  if(sortBy=='name') list.sort((a,b)=> a.name.localeCompare(b.name));
  else if(sortBy=='age') list.sort((a,b)=> (a.age - b.age));
  else if(sortBy=='condition') list.sort((a,b)=> a.condition.localeCompare(b.condition));
  return list;
}

function refreshList(){ populateTable(filteredAndSorted()); generateReport(); if(window.updateDashboard) window.updateDashboard(); }

function exportCSV(){
  if(!patients.length){ alert('No data'); return; }
  const rows = [['Name','Gender','Age','Condition','Added']];
  patients.forEach(p=> rows.push([p.name,p.gender,p.age,p.condition,p.added||'']));
  const csv = rows.map(r=> r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join(' ');
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click(); URL.revokeObjectURL(url);
}

/* ---------- Sample data helper ---------- */
function loadSample(){
  const sample = [
    {id:uid().toString(),name:'Aisha Khan',gender:'Female',age:52,condition:'Diabetes',added:new Date().toISOString()},
    {id:uid().toString(),name:'Bilal Ahmed',gender:'Male',age:45,condition:'High Blood Pressure',added:new Date().toISOString()},
    {id:uid().toString(),name:'Sara Ali',gender:'Female',age:30,condition:'Thyroid',added:new Date().toISOString()},
  ];
  patients = sample.concat(patients);
  savePatients();
  refreshList();
}

/* ---------- Condition lookup (reads JSON) ---------- */
function searchCondition(){
  const q = (conditionInput?.value||'').trim().toLowerCase();
  resultDiv.innerHTML = '';
  if(!q){ resultDiv.innerHTML = '<p class="muted">Type a condition and click Search</p>'; return; }

  fetch('./health_analysis.json')
    .then(r=>r.json())
    .then(data=>{
      const cond = data.conditions.find(c=> c.name.toLowerCase()===q);
      if(!cond){ resultDiv.innerHTML = '<p>Condition not found.</p>'; return; }
      resultDiv.innerHTML = `
        <h3>${cond.name}</h3>
        ${cond.imagesrc? `<img src="${cond.imagesrc}" alt="${cond.name}" />` : ''}
        <p><strong>Symptoms:</strong> ${cond.symptoms.join(', ')}</p>
        <p><strong>Prevention:</strong> ${cond.prevention.join(', ')}</p>
        <p><strong>Treatment:</strong> ${cond.treatment}</p>
      `;
    })
    .catch(e=>{ resultDiv.innerHTML = '<p>Error loading data</p>'; console.error(e); });
}

/* ---------- Dashboard helpers (Chart.js) ---------- */
function initDashboard(){
  window.updateDashboard = function(){
    const condCounts = { Diabetes:0, Thyroid:0, 'High Blood Pressure':0 };
    patients.forEach(p=> condCounts[p.condition] = (condCounts[p.condition]||0)+1);

    // pie
    const pieCtx = document.getElementById('condPie');
    if(pieCtx){
      if(window.condPieChart) window.condPieChart.destroy();
      window.condPieChart = new Chart(pieCtx, {
        type:'pie',
        data:{ labels:Object.keys(condCounts), datasets:[{data:Object.values(condCounts)}] },
        options:{ responsive:true }
      });
    }

    // age bar grouped by condition
    const groups = { Diabetes:[], Thyroid:[], 'High Blood Pressure':[] };
    patients.forEach(p=> groups[p.condition]?.push(Number(p.age)));
    const ageMeans = Object.keys(groups).map(k=>{
      const a = groups[k]; return a.length? Math.round(a.reduce((s,x)=>s+x,0)/a.length) : 0;
    });
    const barCtx = document.getElementById('ageBar');
    if(barCtx){ if(window.ageBarChart) window.ageBarChart.destroy();
      window.ageBarChart = new Chart(barCtx, { type:'bar', data:{ labels:Object.keys(groups), datasets:[{label:'Average age', data:ageMeans}] }, options:{ responsive:true } });
    }

    // summary cards
    const summary = document.getElementById('summaryCards');
    if(summary){
      const total = patients.length;
      const recents = patients.slice(0,3);
      summary.innerHTML = `<div class="card">Total<br><strong>${total}</strong></div>` +
                          `<div class="card">Diabetes<br><strong>${condCounts.Diabetes}</strong></div>` +
                          `<div class="card">Thyroid<br><strong>${condCounts.Thyroid}</strong></div>` +
                          `<div class="card">High BP<br><strong>${condCounts['High Blood Pressure']}</strong></div>`;
    }

    const recentList = document.getElementById('recentList');
    if(recentList){ recentList.innerHTML = patients.slice(0,6).map(p=>`<li>${escapeHtml(p.name)} — ${p.condition} (${p.age})</li>`).join(''); }
  };
  window.updateDashboard();
}

/* ---------- Dark mode toggle ---------- */
function applyTheme(checked){ if(checked) document.documentElement.setAttribute('data-theme','dark'); else document.documentElement.removeAttribute('data-theme'); localStorage.setItem('dark',checked?'1':'0'); }

/* ---------- Helpers ---------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[c]); }

/* ---------- Wire events ---------- */
if(addPatientBtn) addPatientBtn.addEventListener('click', addOrUpdatePatient);
if(clearFormBtn) clearFormBtn.addEventListener('click', clearForm);
if(searchInput) searchInput.addEventListener('input', ()=> populateTable(filteredAndSorted()));
if(sortSelect) sortSelect.addEventListener('change', refreshList);
if(exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
if(importSampleBtn) importSampleBtn.addEventListener('click', loadSample);
if(btnSearch) btnSearch.addEventListener('click', searchCondition);
if(conditionInput) conditionInput.addEventListener('keydown', e=>{ if(e.key==='Enter') searchCondition(); });

window.editPatient = editPatient; // expose to global for buttons
window.deletePatient = deletePatient;

/* ---------- Init on load ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  // theme
  const dark = localStorage.getItem('dark') === '1';
  const tgl = document.getElementById('darkModeToggle');
  if(tgl) { tgl.checked = dark; tgl.addEventListener('change', e=> applyTheme(e.target.checked)); }
  const tglDb = document.getElementById('darkModeToggleDb');
  if(tglDb) { tglDb.checked = dark; tglDb.addEventListener('change', e=> applyTheme(e.target.checked)); }
  applyTheme(dark);

  refreshList();
  // expose dashboard initializer for dashboard page
  window.initDashboard = initDashboard;
});