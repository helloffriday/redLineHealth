/* =========================================================
   Appointments — reads and writes public.appointments directly.
   Mirrors the create/read/update/delete pattern used in
   patients.js / inventory.js.
   ========================================================= */

let allAppts = [];
let editingId = null; // null = "add" mode, otherwise the id being edited

const STATUS_LABEL = {
  confirmed: { pill: "ok", label: "Confirmed" },
  pending: { pill: "warn", label: "Pending" },
  rescheduled: { pill: "neutral", label: "Rescheduled" },
  cancelled: { pill: "danger", label: "Cancelled" },
};

function fmtTime(isoStr) {
  if (!isoStr) return "\u2014";
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function paintTodayLabel() {
  const el = document.getElementById("appt-today-label");
  if (el) {
    el.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
}

function renderAppointments(list) {
  const tbody = document.getElementById("appt-tbody");

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
          <h4>No appointments found</h4>
          <p>Try a different search, or schedule a new appointment.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((a) => {
    const status = STATUS_LABEL[a.status] || { pill: "neutral", label: a.status || "\u2014" };
    return `
      <tr data-status="${a.status || ""}" data-id="${a.id}">
        <td class="mono">${fmtTime(a.appt_datetime)}</td>
        <td>
          <div class="cell-primary">${a.patient_name || "Unnamed"}</div>
          <div class="cell-sub">${a.reason || ""}</div>
        </td>
        <td>${a.provider || "\u2014"}</td>
        <td>${a.department || "\u2014"}</td>
        <td><span class="pill ${status.pill}">${status.label}</span></td>
        <td style="display:flex; gap:6px;">
          <button class="btn-icon appt-edit-btn" data-id="${a.id}" title="Edit appointment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="btn-icon appt-delete-btn" data-id="${a.id}" title="Cancel/delete appointment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
          </button>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".appt-edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => openEditPanel(btn.dataset.id))
  );
  tbody.querySelectorAll(".appt-delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => deleteAppt(btn.dataset.id))
  );
}

function applyFilters() {
  const q = document.getElementById("appt-search").value.trim().toLowerCase();
  const status = document.getElementById("appt-filter").value;
  const filtered = allAppts.filter((a) => {
    const text = `${a.patient_name || ""} ${a.provider || ""} ${a.reason || ""} ${a.department || ""}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesStatus = status === "all" || a.status === status;
    return matchesSearch && matchesStatus;
  });
  renderAppointments(filtered);
}

async function loadAppointments() {
  const { data, error } = await supabaseClient
    .from("appointments")
    .select("*")
    .order("appt_datetime", { ascending: true });

  if (error) {
    console.error(error);
    document.getElementById("appt-tbody").innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          <h4>Couldn't load appointments</h4>
          <p>${error.message}</p>
        </div>
      </td></tr>`;
    return;
  }

  allAppts = data || [];
  applyFilters();
}

document.addEventListener("DOMContentLoaded", async () => {
  paintTodayLabel();
  await requireAuthAndLoadProfile();
  await loadAppointments();
});

document.getElementById("appt-search").addEventListener("input", applyFilters);
document.getElementById("appt-filter").addEventListener("change", applyFilters);

/* ---- add / edit panel ---- */
const panel = document.getElementById("appt-panel");
const toggleBtn = document.getElementById("toggle-new-appt");
const cancelBtn = document.getElementById("appt-cancel");
const form = document.getElementById("appt-form");
const msgBox = document.getElementById("appt-msg");
const submitBtn = document.getElementById("appt-submit");
const spinner = document.getElementById("appt-spinner");
const submitLabel = document.getElementById("appt-submit-label");
const panelTitle = document.getElementById("appt-panel-title");

function splitDateTime(isoStr) {
  if (!isoStr) return { date: "", time: "" };
  const d = new Date(isoStr);
  const date = d.toISOString().slice(0, 10);
  const time = d.toTimeString().slice(0, 5);
  return { date, time };
}

function fillForm(a) {
  const { date, time } = splitDateTime(a?.appt_datetime);
  document.getElementById("ap-patient").value = a?.patient_name || "";
  document.getElementById("ap-reason").value = a?.reason || "";
  document.getElementById("ap-provider").value = a?.provider || "";
  document.getElementById("ap-department").value = a?.department || "";
  document.getElementById("ap-date").value = date;
  document.getElementById("ap-time").value = time;
  document.getElementById("ap-status").value = a?.status || "pending";
}

function openAddPanel() {
  editingId = null;
  panelTitle.textContent = "New appointment";
  submitLabel.textContent = "Save appointment";
  fillForm(null);
  panel.classList.add("open");
  toggleBtn.textContent = "Close";
}

function openEditPanel(id) {
  const a = allAppts.find((x) => String(x.id) === String(id));
  if (!a) return;
  editingId = id;
  panelTitle.textContent = "Edit appointment";
  submitLabel.textContent = "Save changes";
  fillForm(a);
  panel.classList.add("open");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  toggleBtn.textContent = "Close";
}

function closePanel() {
  panel.classList.remove("open");
  toggleBtn.textContent = "+ New appointment";
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

  const patientName = document.getElementById("ap-patient").value.trim();
  const date = document.getElementById("ap-date").value;
  const time = document.getElementById("ap-time").value;

  if (!patientName || !date || !time) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = "Patient name, date, and time are required.";
    return;
  }

  const payload = {
    patient_name: patientName,
    reason: document.getElementById("ap-reason").value.trim() || null,
    provider: document.getElementById("ap-provider").value.trim() || null,
    department: document.getElementById("ap-department").value.trim() || null,
    appt_datetime: new Date(`${date}T${time}`).toISOString(),
    status: document.getElementById("ap-status").value || "pending",
  };

  submitBtn.disabled = true;
  spinner.classList.add("show");
  submitLabel.textContent = "Saving\u2026";

  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from("appointments").update(payload).eq("id", editingId));
  } else {
    ({ error } = await supabaseClient.from("appointments").insert(payload));
  }

  submitBtn.disabled = false;
  spinner.classList.remove("show");
  submitLabel.textContent = editingId ? "Save changes" : "Save appointment";

  if (error) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = error.message;
    return;
  }

  showToast(editingId ? "Appointment updated" : "Appointment scheduled", "success");
  closePanel();
  await loadAppointments();
});

/* ---- delete ---- */
async function deleteAppt(id) {
  const a = allAppts.find((x) => String(x.id) === String(id));
  if (!a) return;
  const confirmed = window.confirm(`Delete the appointment for ${a.patient_name}? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("appointments").delete().eq("id", id);
  if (error) {
    showToast(error.message, "error");
    return;
  }
  showToast("Appointment deleted", "success");
  await loadAppointments();
}
