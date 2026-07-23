/* =========================================================
   Dashboard — read-only rollup pulling live data from
   appointments, inventory_items, maternal_child_cases, and
   reports. No create/edit/delete here; this page reflects
   the other tables, it doesn't own any records itself.
   ========================================================= */

const STATUS_PILL = {
  confirmed: "ok", pending: "warn", rescheduled: "neutral", cancelled: "danger",
};

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function fmtRelative(isoStr) {
  const then = new Date(isoStr).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

async function loadStatsAndAppointments() {
  const { start, end } = todayRange();

  const [apptsRes, inventoryRes, casesRes, reportsRes] = await Promise.all([
    supabaseClient.from("appointments").select("*").gte("appt_datetime", start).lt("appt_datetime", end).order("appt_datetime", { ascending: true }),
    supabaseClient.from("inventory_items").select("id, quantity, reorder_point"),
    supabaseClient.from("maternal_child_cases").select("id, risk"),
    supabaseClient.from("reports").select("id, status"),
  ]);

  // --- Appointments today ---
  const todaysAppts = apptsRes.data || [];
  document.getElementById("stat-appts").textContent = apptsRes.error ? "\u2014" : todaysAppts.length;
  const confirmedToday = todaysAppts.filter((a) => a.status === "confirmed").length;
  document.getElementById("stat-appts-trend").textContent = apptsRes.error ? "" : `${confirmedToday} confirmed`;

  // --- Inventory low stock ---
  const items = inventoryRes.data || [];
  const lowStock = items.filter((i) => (Number(i.quantity) || 0) <= (Number(i.reorder_point) || 0)).length;
  document.getElementById("stat-inventory").textContent = inventoryRes.error ? "\u2014" : lowStock;
  document.getElementById("stat-inventory-trend").textContent = inventoryRes.error ? "" : `of ${items.length} items`;

  // --- Active maternal & child cases ---
  const cases = casesRes.data || [];
  const highRisk = cases.filter((c) => c.risk === "high").length;
  document.getElementById("stat-cases").textContent = casesRes.error ? "\u2014" : cases.length;
  document.getElementById("stat-cases-trend").textContent = casesRes.error ? "" : `${highRisk} high risk`;

  // --- Reports pending ---
  const reports = reportsRes.data || [];
  const pending = reports.filter((r) => r.status === "processing").length;
  document.getElementById("stat-reports").textContent = reportsRes.error ? "\u2014" : pending;
  document.getElementById("stat-reports-trend").textContent = reportsRes.error ? "" : `${reports.length} total`;

  renderUpcoming(todaysAppts);
}

function renderUpcoming(list) {
  const tbody = document.getElementById("dash-appt-tbody");
  const upcoming = list.slice(0, 5);

  if (!upcoming.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><p>No appointments scheduled today.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = upcoming.map((a) => {
    const pill = STATUS_PILL[a.status] || "neutral";
    return `
      <tr>
        <td><div class="cell-primary">${a.patient_name || "Unnamed"}</div><div class="cell-sub">${a.reason || ""}</div></td>
        <td>${a.department || "\u2014"}</td>
        <td class="mono">${fmtTime(a.appt_datetime)}</td>
        <td><span class="pill ${pill}">${a.status ? a.status[0].toUpperCase() + a.status.slice(1) : "\u2014"}</span></td>
      </tr>`;
  }).join("");
}

async function loadActivity() {
  const wrap = document.getElementById("dash-timeline");

  const [inv, cases, reports, appts] = await Promise.all([
    supabaseClient.from("inventory_items").select("name, updated_at").order("updated_at", { ascending: false }).limit(3),
    supabaseClient.from("maternal_child_cases").select("patient_name, stage, updated_at").order("updated_at", { ascending: false }).limit(3),
    supabaseClient.from("reports").select("report_name, generated_at").order("generated_at", { ascending: false }).limit(3),
    supabaseClient.from("appointments").select("patient_name, status, updated_at").order("updated_at", { ascending: false }).limit(3),
  ]);

  const events = [];
  (inv.data || []).forEach((i) => events.push({
    title: `Inventory updated \u2014 ${i.name}`,
    meta: `Inventory \u00b7 ${fmtRelative(i.updated_at)}`,
    ts: i.updated_at,
  }));
  (cases.data || []).forEach((c) => events.push({
    title: `${c.stage ? c.stage[0].toUpperCase() + c.stage.slice(1) : "Case"} case updated \u2014 ${c.patient_name}`,
    meta: `Maternal & Child Care \u00b7 ${fmtRelative(c.updated_at)}`,
    ts: c.updated_at,
  }));
  (reports.data || []).forEach((r) => events.push({
    title: `${r.report_name} generated`,
    meta: `Reports \u00b7 ${fmtRelative(r.generated_at)}`,
    ts: r.generated_at,
  }));
  (appts.data || []).forEach((a) => events.push({
    title: `Appointment ${a.status || "updated"} \u2014 ${a.patient_name}`,
    meta: `Appointments \u00b7 ${fmtRelative(a.updated_at)}`,
    ts: a.updated_at,
  }));

  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const top = events.slice(0, 6);

  if (!top.length) {
    wrap.innerHTML = `<p style="font-size:13px; color:var(--ink-soft);">No recent activity.</p>`;
    return;
  }

  wrap.innerHTML = top.map((e) => `
    <div class="timeline-item">
      <div class="timeline-dot"></div>
      <div class="timeline-body">
        <div class="t-title">${e.title}</div>
        <div class="t-meta">${e.meta}</div>
      </div>
    </div>`).join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthAndLoadProfile();
  await Promise.all([loadStatsAndAppointments(), loadActivity()]);
});
