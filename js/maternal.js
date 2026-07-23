/* =========================================================
   Maternal & Child Care — reads/writes public.maternal_child_cases
   and public.immunization_coverage.
   ========================================================= */

let allCases = [];
let editingId = null;

const STAGE_LABEL = { antenatal: "Antenatal", postnatal: "Postnatal", pediatric: "Pediatric" };
const RISK_PILL = { low: "ok", moderate: "warn", high: "danger" };

function fmtDate(isoStr) {
  if (!isoStr) return "\u2014";
  return new Date(isoStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  return target >= now - 86400000 && target <= now + days * 86400000;
}

function renderStats(list) {
  const antenatal = list.filter((c) => c.stage === "antenatal").length;
  const postnatal = list.filter((c) => c.stage === "postnatal").length;
  const immunizationsDue = list.filter((c) => c.stage === "pediatric" && isWithinDays(c.next_visit, 7)).length;

  document.getElementById("stat-antenatal").textContent = antenatal;
  document.getElementById("stat-postnatal").textContent = postnatal;
  document.getElementById("stat-immunizations").textContent = immunizationsDue;
}

function renderCases(list) {
  const tbody = document.getElementById("case-tbody");

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.7 2.3 4 6 4c2.1 0 3.6 1.1 6 3.4C14.4 5.1 15.9 4 18 4c3.7 0 5.6 3.7 4 7.2-2.5 4.7-10 9.3-10 9.3z"/></svg>
          <h4>No cases found</h4>
          <p>Register a new maternal or child case to get started.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((c) => `
    <tr data-id="${c.id}">
      <td><div class="cell-primary">${c.patient_name}</div><div class="cell-sub">ID: ${c.case_code || "\u2014"}</div></td>
      <td>${STAGE_LABEL[c.stage] || c.stage}</td>
      <td class="mono">${c.stage_detail || "\u2014"}</td>
      <td class="mono">${fmtDate(c.next_visit)}</td>
      <td><span class="pill ${RISK_PILL[c.risk] || "neutral"}">${c.risk ? c.risk[0].toUpperCase() + c.risk.slice(1) : "\u2014"}</span></td>
      <td style="display:flex; gap:6px;">
        <button class="btn-icon case-edit-btn" data-id="${c.id}" title="Edit case">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </button>
        <button class="btn-icon case-delete-btn" data-id="${c.id}" title="Delete case">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
        </button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll(".case-edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => openEditPanel(btn.dataset.id))
  );
  tbody.querySelectorAll(".case-delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => deleteCase(btn.dataset.id))
  );
}

async function loadCases() {
  const { data, error } = await supabaseClient
    .from("maternal_child_cases")
    .select("*")
    .order("next_visit", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("case-tbody").innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          <h4>Couldn't load cases</h4>
          <p>${error.message}</p>
        </div>
      </td></tr>`;
    return;
  }

  allCases = data || [];
  renderStats(allCases);
  renderCases(allCases);
}

/* ---- immunization coverage (editable list, no add/delete — fixed vaccine set) ---- */
async function loadCoverage() {
  const { data, error } = await supabaseClient
    .from("immunization_coverage")
    .select("*")
    .order("vaccine", { ascending: true });

  const wrap = document.getElementById("coverage-list");
  if (error) {
    wrap.innerHTML = `<p class="form-msg show error">${error.message}</p>`;
    return;
  }

  wrap.innerHTML = (data || []).map((row) => `
    <div class="progress-row">
      <span>${row.vaccine}</span>
      <span class="mono coverage-value" data-id="${row.id}" data-percent="${row.percent}" style="cursor:pointer;" title="Click to edit">${row.percent}%</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${row.percent}%"></div></div>
  `).join("");

  wrap.querySelectorAll(".coverage-value").forEach((el) => {
    el.addEventListener("click", async () => {
      const current = el.dataset.percent;
      const next = window.prompt(`New coverage percentage for this vaccine (0-100):`, current);
      if (next === null) return;
      const val = Number(next);
      if (Number.isNaN(val) || val < 0 || val > 100) {
        showToast("Enter a number between 0 and 100", "error");
        return;
      }
      const { error: updErr } = await supabaseClient
        .from("immunization_coverage")
        .update({ percent: val })
        .eq("id", el.dataset.id);
      if (updErr) {
        showToast(updErr.message, "error");
        return;
      }
      showToast("Coverage updated", "success");
      await loadCoverage();
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthAndLoadProfile();
  await loadCases();
  await loadCoverage();
});

/* ---- add / edit case panel ---- */
const panel = document.getElementById("case-panel");
const toggleBtn = document.getElementById("toggle-new-case");
const cancelBtn = document.getElementById("case-cancel");
const form = document.getElementById("case-form");
const msgBox = document.getElementById("case-msg");
const submitBtn = document.getElementById("case-submit");
const spinner = document.getElementById("case-spinner");
const submitLabel = document.getElementById("case-submit-label");
const panelTitle = document.getElementById("case-panel-title");

function fillForm(c) {
  document.getElementById("mc-patient").value = c?.patient_name || "";
  document.getElementById("mc-stage").value = c?.stage || "";
  document.getElementById("mc-detail").value = c?.stage_detail || "";
  document.getElementById("mc-next-visit").value = c?.next_visit || "";
  document.getElementById("mc-risk").value = c?.risk || "low";
}

function openAddPanel() {
  editingId = null;
  panelTitle.textContent = "New case";
  submitLabel.textContent = "Save case";
  fillForm(null);
  panel.classList.add("open");
  toggleBtn.textContent = "Close";
}

function openEditPanel(id) {
  const c = allCases.find((x) => String(x.id) === String(id));
  if (!c) return;
  editingId = id;
  panelTitle.textContent = "Edit case";
  submitLabel.textContent = "Save changes";
  fillForm(c);
  panel.classList.add("open");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  toggleBtn.textContent = "Close";
}

function closePanel() {
  panel.classList.remove("open");
  toggleBtn.textContent = "+ New case";
  form.reset();
  msgBox.className = "form-msg";
  editingId = null;
}

toggleBtn.addEventListener("click", () => {
  panel.classList.contains("open") ? closePanel() : openAddPanel();
});
cancelBtn.addEventListener("click", closePanel);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgBox.className = "form-msg";

  const patientName = document.getElementById("mc-patient").value.trim();
  const stage = document.getElementById("mc-stage").value;
  if (!patientName || !stage) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = "Patient name and stage are required.";
    return;
  }

  const payload = {
    patient_name: patientName,
    stage,
    stage_detail: document.getElementById("mc-detail").value.trim() || null,
    next_visit: document.getElementById("mc-next-visit").value || null,
    risk: document.getElementById("mc-risk").value || "low",
  };

  submitBtn.disabled = true;
  spinner.classList.add("show");
  submitLabel.textContent = "Saving\u2026";

  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from("maternal_child_cases").update(payload).eq("id", editingId));
  } else {
    ({ error } = await supabaseClient.from("maternal_child_cases").insert(payload));
  }

  submitBtn.disabled = false;
  spinner.classList.remove("show");
  submitLabel.textContent = editingId ? "Save changes" : "Save case";

  if (error) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = error.message;
    return;
  }

  showToast(editingId ? "Case updated" : "Case registered", "success");
  closePanel();
  await loadCases();
});

async function deleteCase(id) {
  const c = allCases.find((x) => String(x.id) === String(id));
  if (!c) return;
  const confirmed = window.confirm(`Delete the case for ${c.patient_name}? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("maternal_child_cases").delete().eq("id", id);
  if (error) {
    showToast(error.message, "error");
    return;
  }
  showToast("Case deleted", "success");
  await loadCases();
}
