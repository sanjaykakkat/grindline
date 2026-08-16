// ===== Grindline — Main App (Firebase + Game Logic) =====

import {
  onAuth,
  loadUserData,
  saveUserData,
  createFocusSession,
  updateFocusSession,
  getActiveFocusSession
} from "./auth.js";

import { characters } from "./characters.js";

// ---------- Stamina config ----------
const MAX_STAMINA = 100;
const STAMINA_PER_MINUTE = 0.8;       // ~125 min of focus before empty
const REST_DURATION_MS = 25 * 60 * 1000; // 25 minutes
const LOW_STAMINA_THRESHOLD = 15;     // show rest UI when below this

// ---------- State ----------
let state = null;
let currentUser = null;
let timerInterval = null;
let restInterval = null;
let remainingSeconds = 0;
let isPaused = false;
let currentTaskName = "";
let currentTaskMinutes = 25;
let saveTimeout = null;
let currentSessionId = null;
let currentSessionEndsAt = null;

// ---------- Helpers ----------
function calcAge(birthDateStr) {
  if (!birthDateStr) return null;
  const birth = new Date(birthDateStr + "T00:00:00");
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function formatAge(age) {
  if (!age) return "—";
  const y = age.years === 1 ? "1 year" : `${age.years} years`;
  const m = age.months === 1 ? "1 month" : `${age.months} months`;
  const d = age.days === 1 ? "1 day" : `${age.days} days`;
  return `${y} · ${m} · ${d}`;
}

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.18, level - 1));
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

// Debounced save to Firestore
function queueSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!currentUser || !state) return;
    try {
      await saveUserData(currentUser.uid, {
        name: state.name,
        birthDate: state.birthDate,
        level: state.level,
        xp: state.xp,
        xpToNext: state.xpToNext,
        bounty: state.bounty,
        stamina: state.stamina,
        maxStamina: state.maxStamina,
        gender: state.gender,
        currentCharacterId: state.currentCharacterId,
        unlockedCharacters: state.unlockedCharacters,
        totalFocusMinutes: state.totalFocusMinutes,
        totalSessions: state.totalSessions,
        lastStaminaUpdate: state.lastStaminaUpdate,
        isResting: state.isResting,
        restEndsAt: state.restEndsAt,
        setupDone: true,
      });
    } catch (err) {
      console.error("Save failed:", err);
    }
  }, 800);
}

// ---------- Game logic ----------
function calculateRewards(minutes) {
  const bounty = Math.round(minutes * 1200 * (1 + (state.level - 1) * 0.025));
  const xp = Math.round(minutes * 1.4);
  const staminaCost = Math.max(5, Math.round(minutes * STAMINA_PER_MINUTE));
  return { bounty, xp, staminaCost };
}

// ---------- Character system ----------

function getCharactersForGender(gender) {
  return Object.values(characters)
    .filter(character => character.gender === gender);
}

function checkCharacterUnlocks() {
  const availableCharacters =
    getCharactersForGender(state.gender);

  const newlyUnlocked = [];

  availableCharacters.forEach((character) => {

    if (
      character.levelRequired <= state.level &&
      !state.unlockedCharacters.includes(character.id)
    ) {
      state.unlockedCharacters.push(character.id);
      newlyUnlocked.push(character);
    }

  });

  return newlyUnlocked;
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

    const unlocked = checkCharacterUnlocks();

    newlyUnlocked.push(...unlocked);
  }

  return { leveledUp, newlyUnlocked };
}

function getCurrentCharacter() {
  return characters[state.currentCharacterId] || null;
}

// ---------- Rest system ----------
function checkRestStatus() {
  if (!state.isResting || !state.restEndsAt) return;

  const now = Date.now();
  if (now >= state.restEndsAt) {
    // Rest finished
    state.isResting = false;
    state.restEndsAt = null;
    state.stamina = MAX_STAMINA;
    queueSave();
    showToast("Rest complete! Stamina fully restored.", "success");
    stopRestTimer();
  }
}

function startRest() {
  if (state.isResting) return;

  state.isResting = true;
  state.restEndsAt = Date.now() + REST_DURATION_MS;
  queueSave();
  showToast("Resting for 25 minutes. Come back later.");
  startRestTimer();
  updateUI();
}

function startRestTimer() {
  stopRestTimer();
  restInterval = setInterval(() => {
    checkRestStatus();
    updateRestUI();
  }, 1000);
  updateRestUI();
}

function stopRestTimer() {
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }
}

function updateRestUI() {
  const restArea = document.getElementById("rest-area");
  const restBtn = document.getElementById("rest-btn");
  const restTimer = document.getElementById("rest-timer");
  const countdown = document.getElementById("rest-countdown");
  const restMessage = document.getElementById("rest-message");

  const needsRest = state.stamina < LOW_STAMINA_THRESHOLD || state.isResting;

  if (!needsRest) {
    restArea.classList.add("hidden");
    return;
  }

  restArea.classList.remove("hidden");

  if (state.isResting && state.restEndsAt) {
    const remaining = Math.max(0, Math.ceil((state.restEndsAt - Date.now()) / 1000));
    restBtn.classList.add("hidden");
    restTimer.classList.remove("hidden");
    countdown.textContent = formatTime(remaining);
    restMessage.textContent = "You’re resting. Stamina will return when the timer ends.";
  } else {
    restBtn.classList.remove("hidden");
    restTimer.classList.add("hidden");
    restMessage.textContent = "You’re low on stamina. Take a real break before continuing.";
  }
}

// ---------- UI ----------
function updateUI() {
  if (!state) return;

  checkRestStatus();

  document.getElementById("level").textContent = state.level;
  document.getElementById("xp-text").textContent = `${state.xp} / ${state.xpToNext} XP`;
  document.getElementById("xp-fill").style.width =
    Math.min(100, (state.xp / state.xpToNext) * 100) + "%";
  document.getElementById("bounty").textContent = formatBounty(state.bounty);

  const character = getCurrentCharacter();

if (character) {
  document.getElementById("hero-image").src = character.image;
  document.getElementById("hero-image").alt = character.name;
  document.getElementById("current-character-name").textContent =
    character.name;
}
  document.getElementById("user-name").textContent = state.name || "Captain";
  document.getElementById("user-age").textContent = formatAge(calcAge(state.birthDate));

  document.getElementById("stamina").textContent = `${Math.floor(state.stamina)}/${state.maxStamina}`;
  document.getElementById("stamina-fill").style.width =
    (state.stamina / state.maxStamina) * 100 + "%";

  document.getElementById("total-focus").textContent = state.totalFocusMinutes + " min";
  document.getElementById("total-sessions").textContent = state.totalSessions;
  document.getElementById("forms-unlocked").textContent = state.unlockedCharacters.length;
  

  // Disable start button while resting or no stamina
  const startBtn = document.getElementById("start-btn");
  const canFocus = !state.isResting && state.stamina >= 5;
  startBtn.disabled = !canFocus;

  updateRestUI();
  renderLadder();
}

function renderLadder() {
  const container = document.getElementById("ladder");

  const availableCharacters =
    getCharactersForGender(state.gender);

  container.innerHTML = availableCharacters.map((character) => {

    const unlocked =
      state.unlockedCharacters.includes(character.id);

    const isCurrent =
      state.currentCharacterId === character.id;

    let statusClass = "locked";

    if (isCurrent) {
      statusClass = "current";
    } else if (unlocked) {
      statusClass = "unlocked";
    }

    let reqText = `Unlocks at Level ${character.levelRequired}`;

    if (unlocked && isCurrent) {
      reqText = "Currently active";
    } else if (unlocked) {
      reqText = "Unlocked — tap to equip";
    }

    return `
      <div
        class="ladder-item ${statusClass}"
        data-character="${character.id}"
      >

        <img
          class="ladder-character"
          src="${character.image}"
          alt="${character.name}"
        >

        <div class="ladder-info">
          <div class="ladder-name">
            ${character.name}
          </div>

          <div class="ladder-req">
            ${reqText}
          </div>
        </div>

        ${
          unlocked && !isCurrent
            ? `<button
                 class="btn equip"
                 data-equip="${character.id}"
               >
                 Equip
               </button>`
            : ""
        }

        ${
          !unlocked
            ? `<span style="font-size:0.75rem;font-weight:700;color:var(--text-muted)">
                 Lv ${character.levelRequired}
               </span>`
            : ""
        }

      </div>
    `;

  }).join("");

  container.querySelectorAll("[data-equip]").forEach((btn) => {

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      equipCharacter(btn.dataset.equip);
    });

  });

  container.querySelectorAll(".ladder-item.unlocked").forEach((row) => {

    row.style.cursor = "pointer";

    row.addEventListener("click", () => {

      const id = row.dataset.character;

      if (
        id &&
        id !== state.currentCharacterId
      ) {
        equipCharacter(id);
      }

    });

  });
}

function equipCharacter(id) {

  if (!state.unlockedCharacters.includes(id)) {
    return;
  }

  const character = characters[id];

  if (!character) {
    return;
  }

  state.currentCharacterId = id;

  queueSave();
  updateUI();

  showToast(
    `Equipped ${character.name}`,
    "success"
  );
}

// ---------- Focus session ----------
async function startFocus() {
  if (state.isResting) {
    showToast("You’re still resting. Wait for the timer.");
    return;
  }

  const name = document.getElementById("task-name").value.trim() || "Focus Session";
  const minutes = parseInt(document.getElementById("task-minutes").value, 10);
  const { staminaCost } = calculateRewards(minutes);

  if (state.stamina < staminaCost) {
    showToast(`Not enough Stamina (need ${staminaCost}). Rest first!`);
    updateUI();
    return;
  }

  currentTaskName = name;
  currentTaskMinutes = minutes;
  remainingSeconds = minutes * 60;
  isPaused = false;

  try {
  currentSessionId = await createFocusSession(
  currentUser.uid,
  currentTaskName,
  currentTaskMinutes
);

currentSessionEndsAt =
  Date.now() + currentTaskMinutes * 60 * 1000;

console.log("✅ Focus session created:", currentSessionId);
    
} catch (err) {
  console.error("❌ Failed to create focus session:", err);
  console.error("Error name:", err?.name);
  console.error("Error message:", err?.message);
  console.error("Error stack:", err?.stack);

  showToast("Couldn't start the focus session.");
  return;
  }

  document.getElementById("task-setup").classList.add("hidden");
  document.getElementById("timer-view").classList.remove("hidden");
  document.getElementById("current-task-name").textContent = currentTaskName;
  document.getElementById("timer-display").textContent = formatTime(remainingSeconds);
  document.getElementById("pause-btn").textContent = "Pause";

  state.stamina = Math.max(0, state.stamina - staminaCost);
  queueSave();
  updateUI();

  clearInterval(timerInterval);
  timerInterval = setInterval(tick, 1000);
}

async function tick() {
  if (isPaused) return;

  const remaining = Math.max(
    0,
    Math.ceil((currentSessionEndsAt - Date.now()) / 1000)
  );

  remainingSeconds = remaining;

  document.getElementById("timer-display").textContent =
    formatTime(remaining);

  if (remainingSeconds <= 0) {
    await completeSession();
  }
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById("pause-btn").textContent = isPaused ? "Resume" : "Pause";
}

async function completeSession() {
  clearInterval(timerInterval);
  timerInterval = null;

  // Prevent completing the same session twice
  if (!currentSessionId) {
    console.warn("⚠️ No active session ID.");
    return;
  }

  try {
  await updateFocusSession(currentSessionId, {
    status: "completed",
    rewardGranted: true,
    completedAt: new Date()
  });

  console.log("✅ Focus session completed:", currentSessionId);

} catch (err) {
  console.error("❌ Failed to complete focus session:", err);
  showToast("Couldn't save your completed session.");
  return;
}

sendFocusCompleteNotification();
  

  // ---------------- REWARD ----------------

  const minutes = currentTaskMinutes;

  const { bounty, xp } = calculateRewards(minutes);

  const { leveledUp, newlyUnlocked } = addXP(xp);

  state.bounty += bounty;
  state.totalFocusMinutes += minutes;
  state.totalSessions += 1;

  if (newlyUnlocked.length > 0) {
    state.currentCharacterId =
      newlyUnlocked[newlyUnlocked.length - 1].id;
  }

  queueSave();

  // Clear current session
  currentSessionId = null;
  currentSessionEndsAt = null;

  // Restore UI
  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");
  document.getElementById("task-name").value = "";

  updateUI();

  let msg = `+${formatBounty(bounty)} · +${xp} XP`;

  if (leveledUp) {
    msg += ` · LEVEL ${state.level}!`;
  }

  if (newlyUnlocked.length > 0) {
    msg += ` · New character: ${
      newlyUnlocked[newlyUnlocked.length - 1].name
    }`;
  }

  showToast(
    msg,
    newlyUnlocked.length ? "success" : "gold"
  );
}

async function cancelSession() {
  clearInterval(timerInterval);
  timerInterval = null;

  // Make sure there is actually an active session
  if (!currentSessionId) {
    console.warn("⚠️ No active session to cancel.");
    return;
  }

  try {
    // Mark the session as cancelled in Firestore
    await updateFocusSession(currentSessionId, {
      status: "cancelled",
      cancelledAt: new Date()
    });

    console.log("❌ Focus session cancelled:", currentSessionId);

  } catch (err) {
    console.error("❌ Failed to cancel focus session:", err);
    showToast("Couldn't cancel the focus session.");
    return;
  }

  // Refund stamina
  const { staminaCost } = calculateRewards(currentTaskMinutes);

  state.stamina = Math.min(
    state.maxStamina,
    state.stamina + staminaCost
  );

  queueSave();

  // Clear current session
  currentSessionId = null;
  currentSessionEndsAt = null;

  // Restore setup UI
  document.getElementById("timer-view").classList.add("hidden");
  document.getElementById("task-setup").classList.remove("hidden");

  updateUI();

  showToast("Session cancelled. Stamina refunded.");
}

async function resumeActiveSession() {
  try {
    const session = await getActiveFocusSession(currentUser.uid);

    if (!session) {
      return;
    }

    console.log("🔄 Active session found:", session);

    currentSessionId = session.id;
    currentTaskName = session.taskName;
    currentTaskMinutes = session.durationMinutes;

    const endTime = session.endsAt.toMillis();

    currentSessionEndsAt = endTime;

    remainingSeconds = Math.max(
      0,
      Math.ceil((endTime - Date.now()) / 1000)
    );

    // Show timer
    document.getElementById("task-setup").classList.add("hidden");
    document.getElementById("timer-view").classList.remove("hidden");

    document.getElementById("current-task-name").textContent =
      currentTaskName;

    document.getElementById("timer-display").textContent =
      formatTime(remainingSeconds);

    isPaused = false;

    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);

  } catch (err) {
    console.error("Failed to resume session:", err);
  }
}


// ---------- Auth gate ----------
function showApp() {
  document.getElementById("loading-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

function redirectToLogin() {
  window.location.href = "login.html";
}

// ---------- Init ----------
onAuth(async (user) => {
  if (!user) {
    redirectToLogin();
    return;
  }

  currentUser = user;

  try {
    const data = await loadUserData(user.uid);
    if (!data) {
      // Should not happen if signup created the doc, but fallback
      showToast("User data missing. Please contact support.");
      return;
    }

    state = {
      name: data.name || user.displayName || "Captain",
      birthDate: data.birthDate || "",
      level: data.level ?? 1,
      xp: data.xp ?? 0,
      xpToNext: data.xpToNext ?? 100,
      bounty: data.bounty ?? 0,
      stamina: data.stamina ?? 100,
      maxStamina: data.maxStamina ?? 100,
      gender: data.gender || "male",
      currentCharacterId: data.currentCharacterId || (data.gender === "female"? "nami_001": "luffy_001"),
      unlockedCharacters: data.unlockedCharacters ||[data.gender === "female"? "nami_001": "luffy_001"],
      totalFocusMinutes: data.totalFocusMinutes ?? 0,
      totalSessions: data.totalSessions ?? 0,
      lastStaminaUpdate: data.lastStaminaUpdate || Date.now(),
      isResting: data.isResting || false,
      restEndsAt: data.restEndsAt || null,
      setupDone: true,
    };

    // Resume rest timer if still resting
    if (state.isResting && state.restEndsAt) {
      if (Date.now() >= state.restEndsAt) {
        state.isResting = false;
        state.restEndsAt = null;
        state.stamina = MAX_STAMINA;
        queueSave();
      } else {
        startRestTimer();
      }
    }

    showApp();
    updateUI();
    
    await requestNotificationPermission();
    await resumeActiveSession();

    // Bind events
    document.getElementById("start-btn").addEventListener("click", startFocus);
    document.getElementById("pause-btn").addEventListener("click", togglePause);
    document.getElementById("complete-btn").addEventListener("click", completeSession);
    document.getElementById("cancel-btn").addEventListener("click", cancelSession);
    document.getElementById("rest-btn").addEventListener("click", startRest);

  } catch (err) {
    console.error(err);
    showToast("Failed to load your data.");
  }
});

// ------------- NOTIFICATION ------------------

async function sendFocusCompleteNotification() {
  if (!("Notification" in window)) {
    console.log("🔕 Notifications are not supported.");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("🔕 Notification permission not granted.");
    return;
  }

  const { xp } = calculateRewards(currentTaskMinutes);

  try {
    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification("Focus session complete! 🔥", {
      body: `You completed ${currentTaskMinutes} minutes of focus. +${xp} XP earned!`,
      icon: "./assets/icon.png",
      badge: "./assets/icon.png"
    });

  } catch (err) {
    console.error("🔔 Notification failed:", err);
  }
}
