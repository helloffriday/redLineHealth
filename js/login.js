const form = document.getElementById("login-form");
const empIdInput = document.getElementById("employee-id");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("login-submit");
const btnLabel = document.getElementById("login-submit-label");
const spinner = document.getElementById("login-spinner");
const msgBox = document.getElementById("form-msg");
const toggleBtn = document.getElementById("toggle-password");

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  spinner.classList.toggle("show", isLoading);
  btnLabel.textContent = isLoading ? "Signing in\u2026" : "Sign in";
}

function showMessage(text, kind = "error") {
  msgBox.className = `form-msg show ${kind}`;
  msgBox.innerHTML = `${ICONS_INLINE[kind] || ""}<span>${text}</span>`;
}

function hideMessage() {
  msgBox.className = "form-msg";
  msgBox.innerHTML = "";
}

const ICONS_INLINE = {
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/></svg>`,
};

toggleBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  toggleBtn.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
});

// If already signed in, skip straight to the dashboard.
(async function checkExistingSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) window.location.href = "dashboard.html";
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMessage();

  const employeeId = empIdInput.value.trim();
  const password = passwordInput.value;

  if (!employeeId || !password) {
    showMessage("Enter your Employee ID and password.", "error");
    return;
  }

  setLoading(true);
  try {
    // 1. Resolve Employee ID -> email via RPC (security definer function).
    const { data: email, error: lookupError } = await supabaseClient.rpc(
      "get_email_by_employee_id",
      { emp_id: employeeId }
    );

    if (lookupError || !email) {
      showMessage("Invalid Employee ID or password.", "error");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      showMessage("Invalid Employee ID or password.", "error");
      setLoading(false);
      return;
    }

    btnLabel.textContent = "Success \u2014 redirecting\u2026";
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
    showMessage("Something went wrong. Please try again.", "error");
    setLoading(false);
  }
});
