/* =========================================================
   Shared app-shell logic
   Used by every authenticated page (dashboard, inventory,
   appointments, maternal-child-care, reports, settings).
   ========================================================= */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "dashboard.html", icon: "icon-grid" },
  { key: "patients", label: "Patients", href: "patients.html", icon: "icon-users" },
  { key: "inventory", label: "Inventory", href: "inventory.html", icon: "icon-box" },
  { key: "appointments", label: "Appointments", href: "appointments.html", icon: "icon-calendar" },
  { key: "maternal", label: "Maternal & Child Care", href: "maternal-child-care.html", icon: "icon-heart" },
  { key: "reports", label: "Reports", href: "reports.html", icon: "icon-chart" },
  { key: "settings", label: "Settings", href: "settings.html", icon: "icon-settings" },
];

const ICONS = {
  "icon-grid": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
  "icon-box": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>`,
  "icon-users": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c.6-3.6 3.2-5.6 6.5-5.6s5.9 2 6.5 5.6"/><circle cx="17.5" cy="8.5" r="2.5"/><path d="M15.8 14.6c2.6.4 4.4 2.1 4.9 5"/></svg>`,
  "icon-calendar": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>`,
  "icon-heart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.7 2.3 4 6 4c2.1 0 3.6 1.1 6 3.4C14.4 5.1 15.9 4 18 4c3.7 0 5.6 3.7 4 7.2-2.5 4.7-10 9.3-10 9.3z"/></svg>`,
  "icon-chart": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>`,
  "icon-settings": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1.04 1.56V21a2 2 0 11-4 0v-.09A1.7 1.7 0 008.96 19.4a1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.56-1.04H3a2 2 0 110-4h.09A1.7 1.7 0 004.6 8.96a1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06A1.7 1.7 0 008.96 4.6a1.7 1.7 0 001.04-1.56V3a2 2 0 114 0v.09c0 .68.4 1.29 1.04 1.56.66.28 1.43.14 1.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87c.27.64.88 1.04 1.56 1.04H21a2 2 0 110 4h-.09a1.7 1.7 0 00-1.51 1.04z"/></svg>`,
  "icon-logout": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
  "icon-cross": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/></svg>`,
  "icon-id": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M15 10h3M15 14h3M6 16.5c.6-1.4 1.8-2 3-2s2.4.6 3 2"/></svg>`,
};

function initials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * Injects the left sidebar into #sidebar-root and wires up the logout button.
 * `activeKey` should match one of NAV_ITEMS[].key
 */
function renderSidebar(activeKey) {
  const root = document.getElementById("sidebar-root");
  if (!root) return;

  const navHtml = NAV_ITEMS.map((item) => `
    <li class="nav-item ${item.key === activeKey ? "active" : ""}">
      <a href="${item.href}">
        ${ICONS[item.icon]}
        <span>${item.label}</span>
      </a>
    </li>
  `).join("");

  root.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="mark">${ICONS["icon-cross"]}</div>
        <div>
          <div class="name">Redline Health</div>
          <div class="sub">Staff Portal</div>
        </div>
      </div>

      <div class="sidebar-section-label">Menu</div>
      <ul class="nav-list">${navHtml}</ul>

      <div class="sidebar-user">
        <div class="user-card">
          <div class="user-avatar" id="sidebar-avatar">--</div>
          <div class="user-meta">
            <div class="u-name" id="sidebar-name">Loading&hellip;</div>
            <div class="u-title" id="sidebar-title">&nbsp;</div>
          </div>
        </div>
        <button class="logout-btn" id="logout-btn" type="button">
          ${ICONS["icon-logout"]}
          <span>Log out</span>
        </button>
      </div>
    </aside>
  `;

  document.getElementById("logout-btn").addEventListener("click", handleLogout);
}

async function handleLogout() {
  const btn = document.getElementById("logout-btn");
  if (btn) btn.innerHTML = `${ICONS["icon-logout"]} <span>Signing out&hellip;</span>`;
  try {
    await supabaseClient.auth.signOut();
  } catch (err) {
    console.error("Sign out error:", err);
  }
  window.location.href = "index.html";
}

/**
 * Guards an authenticated page: redirects to login if there is no session,
 * then loads the employee_profiles row for the signed-in user and paints
 * it into the sidebar + topbar id chip.
 * Returns the profile row (or null).
 */
async function requireAuthAndLoadProfile() {
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    window.location.href = "index.html";
    return null;
  }

  const userId = session.user.id;
  const { data: profile, error: profileError } = await supabaseClient
    .from("employee_profiles")
    .select("id, employee_id, full_name, email, title, department")
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Could not load employee profile:", profileError.message);
  }

  const name = profile?.full_name || session.user.email || "Employee";
  const title = profile?.title || "Staff";
  const empId = profile?.employee_id || "—";

  const avatarEl = document.getElementById("sidebar-avatar");
  const nameEl = document.getElementById("sidebar-name");
  const titleEl = document.getElementById("sidebar-title");
  const idChip = document.getElementById("topbar-id-chip");

  if (avatarEl) avatarEl.textContent = initials(name);
  if (nameEl) nameEl.textContent = name;
  if (titleEl) titleEl.textContent = title;
  if (idChip) idChip.innerHTML = `${ICONS["icon-id"]} <span>${empId}</span>`;

  document.querySelectorAll("[data-profile-field]").forEach((el) => {
    const field = el.getAttribute("data-profile-field");
    const map = {
      full_name: profile?.full_name || "",
      email: profile?.email || session.user.email || "",
      title: profile?.title || "",
      department: profile?.department || "",
      employee_id: profile?.employee_id || "",
    };
    if (field in map) {
      if ("value" in el) el.value = map[field];
      else el.textContent = map[field];
    }
  });

  return profile;
}

function showToast(message, type = "info") {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const page = document.body.getAttribute("data-page");
  if (page) renderSidebar(page);
});
