// ===== Grindline — One Piece Personal Version =====

const STORAGE_KEY = "grindline_op_v1";

// Luffy forms ladder (personal theme)
// unlockedByLevel = the level required to unlock this form
const FORMS = [
  {
    id: "fake",
    name: "Fake Luffy",
    emoji: "👒",
    unlockedByLevel: 1,
    desc: "The beginning. A dream and a straw hat.",
  },
  {
    id: "east_blue",
    name: "East Blue Luffy",
    emoji: "🍖",
    unlockedByLevel: 5,
    desc: "First real steps. The journey has begun.",
  },
  {
    id: "paradise",
    name: "Paradise Luffy",
    emoji: "⚔️",
    unlockedByLevel: 12,
    desc: "Stronger. Facing the Grand Line.",
  },
  {
    id: "gear_second",
    name: "Gear 2 Luffy",
    emoji: "🔥",
    unlockedByLevel: 20,
    desc: "Speed and power. A new level of fighting.",
  },
  {
    id: "gear_third",
    name: "Gear 3 Luffy",
    emoji: "💥",
    unlockedByLevel: 30,
    desc: "Giant strength. Bones of a warrior.",
  },
  {
    id: "gear_fourth",
    name: "Gear 4 Luffy",
    emoji: "🦍",
    unlockedByLevel: 45,
    desc: "Boundman. The power that turns the tide.",
  },
  {
    id: "wano",
    name: "Wano Luffy",
    emoji: "🏯",
    unlockedByLevel: 60,
    desc: "Protector of Wano. A captain worthy of the name.",
  },
  {
    id: "gear_five",
    name: "Gear 5 Luffy",
    emoji: "☀️",
    unlockedByLevel: 80,
    desc: "Joy Boy. The one who will be Pirate King.",
  },
];

function defaultState() {
  return {
    name: "",
    birthDate: "",          // YYYY-MM-DD
    level: 1,
    xp: 0,
    xpToNext: 100,
    bounty: 0,
    stamina: 100,
    maxStamina: 100,
    currentFormId: "fake",  // always starts with Fake Luffy
    unlockedForms: ["fake"],
    totalFocusMinutes: 0,
    totalSessions: 0,
    lastStaminaUpdate: Date.now(),
    setupDone: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ===== Age calculation (Y / M / D) =====
function calcAge(birthDateStr) {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr + "T00:00:00");
  const now = new Date();

  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    // days in previous month
    const prev = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prev.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

function formatAge(age) {
  if (!age) return "Set your birth date to see how long you've lived";
  const y = age.years === 1 ? "1 year" : `${age.years} years`;
  const m = age.months === 1 ? "1 month" : `${age.months} months`;
  const d = age.days === 1 ? "1 day" : `${age.days} days`;
  return `${y} · ${m} · ${d}`;
}

// ===== Game helpers =====
const STAMINA_RECOVERY_MS = 3 * 60 * 1000; // 1 stamina / 3 min

function recoverStamina() {
  const now = Date.now();
  const elapsed = now - state.lastStaminaUpdate;
  if (elapsed < STAMINA_RECOVERY_MS) return;

  const recovered = Math.floor(elapsed / STAMINA_RECOVERY_MS);
  if (recovered > 0 && state.stamina < state.maxStamina) {
    state.stamina = Math.min(state.maxStamina, state.stamina + recovered);
    state.lastStaminaUpdate = now - (elapsed % STAMINA_RECOVERY_MS);
    saveState(state);
  }
}

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.18, level - 1));
}

function addXP(amount) {
  state.xp += amount;
  let leveledUp = false;
  const newlyUnlocked = [];

  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = xpForLevel(state.level);
    leveledUp = true;

    // Check for new forms
    FORMS.forEach((form) => {
      if (
        form.unlockedByLevel <= state.level &&
        !state.unlockedForms.includes(form.id)
      ) {
        state.unlockedForms.push(form.id);
        newlyUnlocked.push(form);
      }
    });
  }

  return { leveledUp, newlyUnlocked };
}

function calculateRewards(minutes) {
  const bounty = Math.round(minutes * 1200 * (1 + (state.level - 1) * 0.025));
  const xp = Math.round(minutes * 1.4);
  const staminaCost = Math.max(5, Math.round(minutes * 0.5));
  return { bounty, xp, staminaCost };
}

function formatBounty(n) {
  if (n >= 1_000_000_000) return "฿" + (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return "฿" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "฿" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return "฿" + n.toLocaleString();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function showToast(message, type = "") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = "toast " + type;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), 3400);
}

// ===== UI =====

let state = loadState();
let timerInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let currentTaskName = "";
let currentTaskMinutes = 25;

function getCurrentForm() {
  return FORMS.find((f) => f.id === state.currentFormId) || FORMS[0];
}

function updateUI() {
  recoverStamina();

  // Top stats
  document.getElementById("level").textContent = state.level;
  document.getElementById("xp-text").textContent = `${state.xp} / ${state.xpToNext} XP`;
  document.getElementById("xp-fill").style.width =
    Math.min(100, (state.xp / state.xpToNext) * 100) + "%";
  document.getElementById("bounty").textContent = formatBounty(state.bounty);

  // Hero
  const form = getCurrentForm();
  document.getElementById("hero-emoji").textContent = form.emoji;
  document.getElementById("current-form-name").textContent = form.name;

  document.getElementById("user-name").textContent = state.name || "Captain";
  const age = calcAge(state.birthDate);
  document.getElementById("user-age").textContent = formatAge(age);

  // Stamina
  document.getElementById("stamina").textContent = `${state.stamina}/${state.maxStamina}`;
  document.getElementById("stamina-fill").style.width =
    (state.stamina / state.maxStamina) * 100 + "%";

  // Setup card visibility
  const setupCard = document.getElementById("setup-card");
  if (state.setupDone) {
    setupCard.classList.add("hidden");
  } else {
    setupCard.classList.remove("hidden");
  }

  // Voyage stats
  document.getElementById("total-focus").textContent = state.totalFocusMinutes + " min";
  document.getElementById("total-sessions").textContent = state.totalSessions;
  document.getElementById("forms-unlocked").textContent = state.unlockedForms.length;

  renderLadder();
}

function renderLadder() {
  const container = document.getElementById("ladder");
  container.innerHTML = FORMS.map((form) => {
    const unlocked = state.unlockedForms.includes(form.id);
    const isCurrent = state.currentFormId === form.id;
    const locked = !unlocked;

    let statusClass = "locked";
    if (isCurrent) statusClass = "current";
    else if (unlocked) statusClass = "unlocked";

    let reqText = `Unlocks at Level ${form.unlockedByLevel}`;
    if (unlocked && isCurrent) reqText = "Currently active";
    else if (unlocked) reqText = "Unlocked — tap to equip";

    return `
      <div class="ladder-item ${statusClass}" data-form="${form.id}">
        <div class="ladder-emoji">${form.emoji}</div>
        <div class="ladder-info">
          <div class="ladder-name">${form.name}</div>
          <div class="ladder-req">${reqText}</div>
        </div>
        ${
          unlocked && !isCurrent
            ? `<button class="btn equip" data-equip="${form.id}">Equip</button>`
            : ""
        }
        ${
          locked
            ? `<span style="font-size:0.75rem;font-weight:700;color:var(--text-muted)">Lv ${form.unlockedByLevel}</span>`
            : ""
        }
      </div>
    `;
  }).join("");

  container.querySelectorAll("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      equipForm(btn.dataset.equip);
    });
  });

  // Also allow clicking the whole unlocked row to equip
  container.querySelectorAll(".ladder-item.unlocked").forEach((row) => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      const id = row.dataset.form;
      if (id && id !== state.currentFormId) equipForm(id);
    });
  });
}

function equipForm(id) {
  if (!state.unlockedForms.includes(id)) return;
  state.currentFormId = id;
  saveState(state);
  updateUI();
  const form = FORMS.find((f) => f.id === id);
  showToast(`Equipped ${form.name}`, "success");
}

// ===== Actions =====

function saveSetup() {
  const name = document.getElementById("input-name").value.trim();
  const birth = document.getElementById("input-birth").value;

  if (!name) {
    showToast("Please enter your name");
    return;
  }
  if (!birth) {
    showToast("Please set your birth date");
    return;
  }

  state.name = name;
  state.birthDate = birth;
  state.setupDone = true;
  saveState(state);
  updateUI();
  showToast(`Welcome aboard, ${name}!`, "success");
}

function startFocus() {
  if (!state.setupDone) {
    showToast("Finish setup first");
    return;
  }

  const nameInput = document.getElementById("task-name");
  const minutesSelect = document.getElementById("task-minutes");
  const name = nameInput.value.trim() || "Focus Session";
  const minutes = parseInt(minutesSelect.value, 10);

  const { staminaCost } = calculateRewards(minutes);
  if (state.stamina < staminaCost) {
    showToast(`Not enough Stamina (need ${staminaCost}). Rest a bit!`);
    return;
  }

  currentTaskName = name;
  currentTaskMinutes = minutes;
  remainingSeconds = minutes * 60;
  isPaused = false;

  document.getElementById("task-setup").classList.add("hidden");
  document.getElementById("timer-view").classList.remove("hidden");
  document.getElementById("current-task-name").textContent = currentTaskName;
  document.getElementById("timer-display").textContent = formatTime(remainingSeconds);
  document.getElementById("pause-btn").textContent = "Pause";

  state.stamina -= staminaCost;
  state.lastStaminaUpdate = Date.now();
  saveState(state);
  updateUI();

  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

function tick() {
  if (isPaused) return;
  remainingSeconds -= 1;
  document.getElementById("timer-display").textContent =
    formatTime(Math.max(0, remainingSeconds));

  if (remainingSeconds <= 0) {
    clearInterval(timerInterval);
    timerInterval = null;
    completeSession();
  }
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
}

function completeSession() {
  clearInterval(timerInterval);
  timerInterval = null;

  const minutes = currentTaskMinutes;
  const { bounty, xp } = calculateRewards(minutes);

  const { leveledUp, newlyUnlocked } = addXP(xp);
  state.bounty += bounty;
  state.totalFocusMinutes += minutes;
  state.totalSessions += 1;

  // Auto-equip the highest newly unlocked form (feels rewarding)
  if (newlyUnlocked.length > 0) {
    const best = newlyUnlocked[newlyUnlocked.length - 1];
    state.currentFormId = best.id;
  }

  saveState(state);

  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");
  document.getElementById("task-name").value = "";

  updateUI();

  let msg = `+${formatBounty(bounty)}  ·  +${xp} XP`;
  if (leveledUp) msg += `  ·  LEVEL ${state.level}!`;
  if (newlyUnlocked.length > 0) {
    msg += `  ·  New form: ${newlyUnlocked[newlyUnlocked.length - 1].name}`;
  }
  showToast(msg, newlyUnlocked.length ? "success" : "gold");
}

function cancelSession() {
  clearInterval(timerInterval);
  timerInterval = null;

  const { staminaCost } = calculateRewards(currentTaskMinutes);
  state.stamina = Math.min(state.maxStamina, state.stamina + staminaCost);
  state.lastStaminaUpdate = Date.now();
  saveState(state);

  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");
  updateUI();
  showToast("Session cancelled. Stamina refunded.");
}

// ===== Init =====
document.getElementById("save-setup-btn").addEventListener("click", saveSetup);
document.getElementById("start-btn").addEventListener("click", startFocus);
document.getElementById("pause-btn").addEventListener("click", togglePause);
document.getElementById("complete-btn").addEventListener("click", completeSession);
document.getElementById("cancel-btn").addEventListener("click", cancelSession);

// Stamina recovery tick
setInterval(() => {
  recoverStamina();
  updateUI();
}, 30000);

// Initial render
updateUI();
