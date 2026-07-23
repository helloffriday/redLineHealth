/* =========================================================
   Patient record detail — reads/updates/deletes a single row
   in public.patients, selected via ?id=<uuid>.
   ========================================================= */

const FIELD_IDS = {
  full_name: "pd-full-name",
  date_of_birth: "pd-dob",
  sex: "pd-sex",
  contact_number: "pd-contact",
  email: "pd-email",
  guardian_name: "pd-guardian",
  blood_type: "pd-blood",
  address: "pd-address",
  allergies: "pd-allergies",
  notes: "pd-notes",
};

let currentPatient = null;
let editing = false;

function initialsOf(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function fmtDate(isoStr) {
  if (!isoStr) return "\u2014";
  return new Date(isoStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function paintPatient(p) {
  document.getElementById("pd-avatar").textContent = initialsOf(p.full_name);
  document.getElementById("pd-name").textContent = p.full_name || "Unnamed patient";
  document.getElementById("pd-code").textContent = p.patient_code || "\u2014";

  const age = calcAge(p.date_of_birth);
  const sexLabel = p.sex ? p.sex[0].toUpperCase() + p.sex.slice(1) : "Sex not set";
  document.getElementById("pd-age-sex").textContent = age !== null ? `${age} yrs \u00b7 ${sexLabel}` : sexLabel;
  document.getElementById("pd-created").textContent = fmtDate(p.created_at);

  Object.entries(FIELD_IDS).forEach(([field, id]) => {
    const el = document.getElementById(id);
    if (el) el.value = p[field] || "";
  });
}

function setEditing(on) {
  editing = on;
  Object.values(FIELD_IDS).forEach((id) => {
    document.getElementById(id).disabled = !on;
  });
  document.getElementById("pd-save-row").style.display = on ? "flex" : "none";
  document.getElementById("pd-edit-btn").textContent = on ? "Editing\u2026" : "Edit";
  document.getElementById("pd-edit-btn").disabled = on;
}

async function loadPatient() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    document.getElementById("detail-empty").style.display = "block";
    return;
  }

  const { data, error } = await supabaseClient
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(error);
    document.getElementById("detail-empty").style.display = "block";
    return;
  }

  currentPatient = data;
  document.getElementById("detail-content").style.display = "block";
  paintPatient(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthAndLoadProfile();
  await loadPatient();
});

document.getElementById("pd-edit-btn").addEventListener("click", () => setEditing(true));

document.getElementById("pd-cancel-btn").addEventListener("click", () => {
  paintPatient(currentPatient);
  setEditing(false);
  const msg = document.getElementById("pd-msg");
  msg.className = "form-msg";
});

document.getElementById("pd-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("pd-msg");
  msg.className = "form-msg";

  const fullName = document.getElementById("pd-full-name").value.trim();
  if (!fullName) {
    msg.className = "form-msg show error";
    msg.textContent = "Full name is required.";
    return;
  }

  const payload = {};
  Object.entries(FIELD_IDS).forEach(([field, id]) => {
    const val = document.getElementById(id).value;
    payload[field] = val === "" ? null : val;
  });

  const btn = document.getElementById("pd-save-btn");
  const spinner = document.getElementById("pd-spinner");
  const label = document.getElementById("pd-save-label");
  btn.disabled = true;
  spinner.classList.add("show");
  label.textContent = "Saving\u2026";

  const { data, error } = await supabaseClient
    .from("patients")
    .update(payload)
    .eq("id", currentPatient.id)
    .select()
    .single();

  btn.disabled = false;
  spinner.classList.remove("show");
  label.textContent = "Save changes";

  if (error) {
    msg.className = "form-msg show error";
    msg.textContent = error.message;
    return;
  }

  currentPatient = data;
  paintPatient(data);
  setEditing(false);
  showToast("Patient record updated", "success");
});

document.getElementById("pd-delete-btn").addEventListener("click", async () => {
  if (!currentPatient) return;
  const confirmed = window.confirm(`Delete the record for ${currentPatient.full_name}? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("patients").delete().eq("id", currentPatient.id);
  if (error) {
    showToast(error.message, "error");
    return;
  }
  window.location.href = "patients.html";
});
