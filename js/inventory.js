/* =========================================================
   Inventory — reads and writes public.inventory_items directly.
   Mirrors the create/read/update/delete pattern used in
   patients.js / patient-detail.js.
   ========================================================= */

let allItems = [];
let editingId = null; // null = "add" mode, otherwise the id being edited

const CATEGORY_LABEL = {
  medication: "Medication",
  supplies: "Supplies",
  equipment: "Equipment",
};

function fmtRelative(isoStr) {
  if (!isoStr) return "\u2014";
  const then = new Date(isoStr).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(isoStr).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function statusFor(item) {
  const qty = Number(item.quantity) || 0;
  const reorder = Number(item.reorder_point) || 0;
  if (qty <= reorder) return { cls: "danger", label: "Low stock" };
  if (qty <= reorder * 1.5) return { cls: "warn", label: "Reorder soon" };
  return { cls: "ok", label: "In stock" };
}

function isExpiringThisMonth(item) {
  if (!item.expires_at) return false;
  const exp = new Date(item.expires_at);
  const now = new Date();
  return exp.getFullYear() === now.getFullYear() && exp.getMonth() === now.getMonth();
}

function renderStats(list) {
  const lowStock = list.filter((i) => statusFor(i).cls === "danger").length;
  const inStock = list.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const expiring = list.filter(isExpiringThisMonth).length;

  document.getElementById("stat-low-stock").textContent = lowStock;
  document.getElementById("stat-in-stock").textContent = inStock;
  document.getElementById("stat-expiring").textContent = expiring;
}

function renderInventory(list) {
  const tbody = document.getElementById("inventory-tbody");

  if (!list.length) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
          <h4>No items found</h4>
          <p>Try a different search, or add a new item.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((item) => {
    const status = statusFor(item);
    return `
      <tr data-category="${item.category}" data-id="${item.id}">
        <td>
          <div class="cell-primary">${item.name}</div>
          <div class="cell-sub">${item.detail || ""}</div>
        </td>
        <td>${CATEGORY_LABEL[item.category] || item.category}</td>
        <td class="mono">${item.sku || "\u2014"}</td>
        <td class="mono">${item.quantity} ${item.quantity_unit || ""}</td>
        <td><span class="pill ${status.cls}">${status.label}</span></td>
        <td class="mono">${fmtRelative(item.updated_at)}</td>
        <td style="display:flex; gap:6px;">
          <button class="btn-icon inv-edit-btn" data-id="${item.id}" title="Edit item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="btn-icon inv-delete-btn" data-id="${item.id}" title="Delete item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"/></svg>
          </button>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".inv-edit-btn").forEach((btn) =>
    btn.addEventListener("click", () => openEditPanel(btn.dataset.id))
  );
  tbody.querySelectorAll(".inv-delete-btn").forEach((btn) =>
    btn.addEventListener("click", () => deleteItem(btn.dataset.id))
  );
}

function applyFilters() {
  const q = document.getElementById("inventory-search").value.trim().toLowerCase();
  const cat = document.getElementById("inventory-filter").value;
  const filtered = allItems.filter((item) => {
    const text = `${item.name} ${item.detail || ""} ${item.sku || ""}`.toLowerCase();
    const matchesSearch = !q || text.includes(q);
    const matchesCat = cat === "all" || item.category === cat;
    return matchesSearch && matchesCat;
  });
  renderInventory(filtered);
}

async function loadInventory() {
  const { data, error } = await supabaseClient
    .from("inventory_items")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    document.getElementById("inventory-tbody").innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
          <h4>Couldn't load inventory</h4>
          <p>${error.message}</p>
        </div>
      </td></tr>`;
    return;
  }

  allItems = data || [];
  renderStats(allItems);
  applyFilters();
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuthAndLoadProfile();
  await loadInventory();
});

document.getElementById("inventory-search").addEventListener("input", applyFilters);
document.getElementById("inventory-filter").addEventListener("change", applyFilters);

/* ---- add / edit panel ---- */
const panel = document.getElementById("item-panel");
const toggleBtn = document.getElementById("toggle-new-item");
const cancelBtn = document.getElementById("item-cancel");
const form = document.getElementById("item-form");
const msgBox = document.getElementById("item-msg");
const submitBtn = document.getElementById("item-submit");
const spinner = document.getElementById("item-spinner");
const submitLabel = document.getElementById("item-submit-label");
const panelTitle = document.getElementById("item-panel-title");

function fillForm(item) {
  document.getElementById("it-name").value = item?.name || "";
  document.getElementById("it-detail").value = item?.detail || "";
  document.getElementById("it-category").value = item?.category || "";
  document.getElementById("it-sku").value = item?.sku || "";
  document.getElementById("it-quantity").value = item?.quantity ?? "";
  document.getElementById("it-unit").value = item?.quantity_unit || "";
  document.getElementById("it-reorder").value = item?.reorder_point ?? "";
  document.getElementById("it-expires").value = item?.expires_at || "";
  document.getElementById("it-notes").value = item?.notes || "";
}

function openAddPanel() {
  editingId = null;
  panelTitle.textContent = "Add item";
  submitLabel.textContent = "Save item";
  fillForm(null);
  panel.classList.add("open");
  toggleBtn.textContent = "Close";
}

function openEditPanel(id) {
  const item = allItems.find((i) => String(i.id) === String(id));
  if (!item) return;
  editingId = id;
  panelTitle.textContent = "Edit item";
  submitLabel.textContent = "Save changes";
  fillForm(item);
  panel.classList.add("open");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  toggleBtn.textContent = "Close";
}

function closePanel() {
  panel.classList.remove("open");
  toggleBtn.textContent = "+ Add item";
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

  const name = document.getElementById("it-name").value.trim();
  const category = document.getElementById("it-category").value;
  if (!name || !category) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = "Item name and category are required.";
    return;
  }

  const payload = {
    name,
    detail: document.getElementById("it-detail").value.trim() || null,
    category,
    sku: document.getElementById("it-sku").value.trim() || null,
    quantity: Number(document.getElementById("it-quantity").value) || 0,
    quantity_unit: document.getElementById("it-unit").value.trim() || "units",
    reorder_point: Number(document.getElementById("it-reorder").value) || 0,
    expires_at: document.getElementById("it-expires").value || null,
    notes: document.getElementById("it-notes").value.trim() || null,
  };

  submitBtn.disabled = true;
  spinner.classList.add("show");
  submitLabel.textContent = "Saving\u2026";

  let error;
  if (editingId) {
    ({ error } = await supabaseClient.from("inventory_items").update(payload).eq("id", editingId));
  } else {
    ({ error } = await supabaseClient.from("inventory_items").insert(payload));
  }

  submitBtn.disabled = false;
  spinner.classList.remove("show");
  submitLabel.textContent = editingId ? "Save changes" : "Save item";

  if (error) {
    msgBox.className = "form-msg show error";
    msgBox.textContent = error.message;
    return;
  }

  showToast(editingId ? "Item updated" : "Item added", "success");
  closePanel();
  await loadInventory();
});

/* ---- delete ---- */
async function deleteItem(id) {
  const item = allItems.find((i) => String(i.id) === String(id));
  if (!item) return;
  const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
  if (!confirmed) return;

  const { error } = await supabaseClient.from("inventory_items").delete().eq("id", id);
  if (error) {
    showToast(error.message, "error");
    return;
  }
  showToast("Item deleted", "success");
  await loadInventory();
}