/* =========================================================
   Patients list — reads and writes public.patients directly.
   ========================================================= */

let allPatients = [];

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function fmtDate(isoStr) {
  if (!isoStr) return "\u2014";
  const d = new Date(isoStr);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function renderPatients(list) {
  const tbody = document.getElementById("patients-tbody");
  const countEl = document.getElementById("patient-count");

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/></svg>
          <h4>No patients found</h4>
          <p>Try a different search, or register a new patient.</p>
        </div>
      </td></tr>`;
    countEl.textContent = "All patients";
    return;
  }

  countEl.textContent = `All patients (${list.length})`;

  tbody.innerHTML = list.map((p) => {
    const age = calcAge(p.date_of_birth);
    const ageLabel = age !== null ? `${age} yrs` : "\u2014";
    return `
      <tr>
        <td>
          <div class="cell-primary">${p.full_name || "Unnamed patient"}</div>
          <div class="cell-sub">${p.email || ""}</div>
        </td>
        <td class="mono">${p.patient_code || "\u2014"}</td>
        <td class="mono">${ageLabel}${p.date_of_birth ? " &middot; " + fmtDate(p.date_of_birth) : ""}</td>
        <td>${p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : "\u2014"}</td>
        <td class="mono">${p.contact_number || "\u2014"}</td>
        <td class="mono">${fmtDate(p.created_at)}</td>
        <td>
          <a class="btn-icon" href="patient-detail.html?id=${encodeURIComponent(p.id)}" title="View record">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </td>
      </tr>`;
  }).join("");
}

async function loadPatients() {
  const { data, error } = await supabaseClient
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("patients-tbody").innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          <h4>Couldn't load patients</h4>
          <p>${error.message}</p>
        </div>
      </td></tr>`;
    return;
  }

  allPatients = data || [];
  renderPatients(allPatients);
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthAndLoadProfile();
  await loadPatients();
});

// ---- search ----
document.getElementById("patient-search").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return renderPatients(allPatients);
  const filtered = allPatients.filter((p) =>
    (p.full_name || "").toLowerCase().includes(q) ||
    (p.patient_code || "").toLowerCase().includes(q) ||
    (p.contact_number || "").toLowerCase().includes(q)
  );
  renderPatients(filtered);
});

// ---- new patient panel ----
const panel = document.getElementById("new-patient-panel");
const toggleBtn = document.getElementById("toggle-new-patient");
const cancelBtn = document.getElementById("np-cancel");
const form = document.getElementById("new-patient-form");
const msgBox = document.getElementById("new-patient-msg");
const submitBtn = document.getElementById("np-submit");
const spinner = document.getElementById("np-spinner");
const submitLabel = document.getElementById("np-submit-label");

function openPanel() {
  panel.classList.add("open");
  toggleBtn.textContent = "Close";
}
function closePanel() {
  panel.classList.remove("open");
  toggleBtn.textContent = "+ New patient";
  form.reset();
  msgBox.className = "form-msg";
}

toggleBtn.addEventListener("click", () => {
  panel.classList.contains("open") ? closePanel() : openPanel();
});
cancelBtn.addEventListener("click", closePanel);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgBox.className = "form-msg";

  const fullName = document.getElementById("np-full-name").value.trim();
  if (!fullName) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = "Full name is required.";
    return;
  }

  const payload = {
    full_name: fullName,
    date_of_birth: document.getElementById("np-dob").value || null,
    sex: document.getElementById("np-sex").value || null,
    contact_number: document.getElementById("np-contact").value.trim() || null,
    email: document.getElementById("np-email").value.trim() || null,
    guardian_name: document.getElementById("np-guardian").value.trim() || null,
    blood_type: document.getElementById("np-blood").value || null,
    address: document.getElementById("np-address").value.trim() || null,
  };

  submitBtn.disabled = true;
  spinner.classList.add("show");
  submitLabel.textContent = "Saving\u2026";

  const { error } = await supabaseClient.from("patients").insert(payload);

  submitBtn.disabled = false;
  spinner.classList.remove("show");
  submitLabel.textContent = "Save patient";

  if (error) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = error.message;
    return;
  }

  showToast("Patient registered", "success");
  closePanel();
  await loadPatients();
});
