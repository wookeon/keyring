(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const icon = (name) => '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[character]);
  const accounts = [
    { id:"github-personal", nickname:"GitHub", loginId:"jamie.kim", site:"github.com", modes:["personal"], groups:["개발"], pinned:true, totp:true },
    { id:"google", nickname:"Google", loginId:"jamie.kim@example.com", site:"google.com", modes:[], groups:["생활"], pinned:true, totp:true },
    { id:"github-work", nickname:"GitHub", loginId:"jamie-work", site:"github.com", modes:["work"], groups:["개발"], pinned:false, totp:true },
    { id:"notion", nickname:"Notion", loginId:"jamie.kim@example.com", site:"notion.so", modes:[], groups:["협업"], pinned:false, totp:false },
    { id:"figma", nickname:"Figma", loginId:"jamie.kim@example.com", site:"figma.com", modes:["work"], groups:["디자인"], pinned:false, totp:true },
    { id:"slack", nickname:"Slack", loginId:"jamie@example.com", site:"slack.com", modes:["work"], groups:["협업"], pinned:false, totp:false },
    { id:"aws", nickname:"AWS", loginId:"jamie-admin", site:"signin.aws.amazon.com", modes:["work"], groups:["개발"], pinned:false, totp:true },
    { id:"apple", nickname:"Apple", loginId:"jamie.kim@icloud.com", site:"apple.com", modes:["personal"], groups:["생활"], pinned:false, totp:true },
  ];
  const modeNames = { all:"전체 계정", work:"업무", personal:"개인" };
  const state = { device:"mac", mode:"all", filter:"all", group:"", query:"", screen:"list", accountId:null, reveal:false, vpnConnected:false };
  const app = $("#app-screen");
  const frame = $("#app-preview");
  const toast = $(".toast");
  const demoPassword = "Demo-Passw0rd!";
  let toastTimer;
  let loginTimer;
  let dropdownInput = null;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(label + " 복사됨");
    } catch {
      showToast("클립보드에 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  function avatarColor(identity) {
    const colors = ["var(--accent)", "#3b66b0", "#785cad", "#a36933", "#a65270", "#576b80"];
    const hash = new TextEncoder().encode(identity.toLowerCase()).reduce((value, byte) => BigInt.asUintN(64, value * 31n + BigInt(byte)), 0n);
    return colors[Number(hash % BigInt(colors.length))];
  }

  function avatar(account) {
    return '<span class="avatar" aria-hidden="true" style="--avatar-color:' + avatarColor(account.site) + '">' + escapeHTML(Array.from(account.nickname.trim())[0]?.toUpperCase() || "K") + '</span>';
  }

  function iconButton(action, name, label) {
    return '<button type="button" class="icon-button" data-app="' + action + '" aria-label="' + label + '" title="' + label + '">' + icon(name) + '</button>';
  }

  function modeOptions() {
    return Object.entries(modeNames).map(([value, name]) => '<option value="' + value + '"' + (state.mode === value ? " selected" : "") + '>' + name + '</option>').join("");
  }

  function modeAccounts() {
    return accounts.filter(account => state.mode === "all" || !account.modes.length || account.modes.includes(state.mode));
  }

  function filteredAccounts() {
    const query = state.query.trim().toLocaleLowerCase();
    return modeAccounts().filter(account => (state.filter !== "pinned" || account.pinned)
      && (!state.group || account.groups.includes(state.group))
      && [account.nickname, account.loginId, account.site, ...account.groups].join(" ").toLocaleLowerCase().includes(query));
  }

  function row(account) {
    const tags = [...account.groups, ...(account.modes.length ? account.modes.map(mode => modeNames[mode]) : ["공용"])];
    return '<li><button class="account-row" type="button" data-account="' + escapeHTML(account.id) + '">' + avatar(account)
      + '<span class="account-text"><strong>' + escapeHTML(account.nickname) + '</strong><span>' + escapeHTML(account.loginId)
      + '</span><span class="account-tags">' + escapeHTML(tags.join(" · ")) + '</span></span>'
      + (account.totp ? '<svg class="row-indicator" aria-label="OTP 등록됨"><use href="#i-code"/></svg>' : "")
      + (account.pinned ? '<svg class="row-indicator" aria-label="고정됨"><use href="#i-pin"/></svg>' : "") + '</button></li>';
  }

  function renderAccountList() {
    const list = $(".app-accounts", app);
    if (!list) return;
    const visible = filteredAccounts();
    if (!visible.length) {
      list.innerHTML = '<li class="app-empty">' + (state.query ? "검색 결과가 없습니다.<br>다른 이름이나 사이트로 검색해 보세요." : "이 조건에 맞는 계정이 없습니다.") + '</li>';
      return;
    }
    const pinned = state.filter === "all" && !state.group && !state.query ? visible.filter(account => account.pinned) : [];
    list.innerHTML = pinned.length
      ? '<li class="account-section">고정된 계정</li>' + pinned.map(row).join("")
        + (visible.some(account => !account.pinned) ? '<li class="account-section">나머지 계정</li>' + visible.filter(account => !account.pinned).map(row).join("") : "")
      : visible.map(row).join("");
  }

  function subhead(title, actions = "") {
    return '<div class="app-subhead">' + iconButton("back", "back", "계정 목록으로 돌아가기") + '<strong>' + title + '</strong>' + actions + '</div>';
  }

  function renderApp() {
    frame.dataset.device = state.device;
    if (state.screen === "detail") {
      renderDetail();
      return;
    }
    if (state.screen === "add") {
      app.innerHTML = subhead("계정 추가") + '<div class="app-body"><form class="demo-form" id="add-account-form"><label>계정 이름<input name="nickname" value="새 예시 계정" maxlength="40" required></label><label>아이디<input value="demo@example.com" readonly></label><label>모드<select name="mode"><option value="">공용 · 모든 모드에 표시</option><option value="work">업무</option><option value="personal">개인</option></select></label><button type="submit" class="primary">예시 계정 추가</button></form><p class="body-note">이 미리보기에는 예시 계정만 추가됩니다. 페이지를 새로고침하면 초기화됩니다.</p></div>';
      return;
    }
    if (state.screen === "settings") {
      app.innerHTML = subhead("설정") + '<div class="app-body"><div class="settings-row"><strong>iCloud</strong><span>같은 Apple 계정으로 동기화</span></div><label class="settings-row"><strong>화면 모드</strong><select id="app-theme" aria-label="앱 미리보기 화면 모드"><option value="system">시스템 설정 따르기</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label><div class="settings-row"><strong>앱 잠금</strong><span>' + (state.device === "ios" ? "Face ID · 기기 암호" : "Touch ID · Mac 암호") + '</span></div><p class="body-note">실제 앱의 설정에서 자동 완성, 다른 앱에서 가져오기, KDBX 백업을 관리할 수 있습니다.</p></div>';
      $("#app-theme").value = $("#theme").value;
      return;
    }
    if (state.screen === "vpn") {
      app.innerHTML = subhead("VPN") + '<div class="app-body"><div class="vpn-state">' + icon("shield") + '<strong>업무 VPN</strong><p>vpn.example.com<br>' + (state.vpnConnected ? "연결됨 · 예시" : "연결되지 않음 · 예시") + '</p><button type="button" class="primary" data-app="vpn-toggle">' + (state.vpnConnected ? "연결 해제 체험" : "연결 체험") + '</button></div><p class="body-note">연결 상태를 보여 주는 예시입니다. 실제 VPN 서버에 연결하지 않습니다. 앱에서는 별도 VPN 창에서 연결을 관리합니다.</p></div>';
      return;
    }
    const visible = modeAccounts();
    const groups = [...new Set(visible.flatMap(account => account.groups))].sort((a, b) => a.localeCompare(b, "ko"));
    if (!groups.includes(state.group)) state.group = "";
    app.innerHTML = '<div class="app-head"><img class="app-logo" src="assets/icon.png" alt=""><div class="app-brand"><strong>' + (state.device === "ios" && state.mode !== "all" ? modeNames[state.mode] : "Keyring") + '</strong><select class="app-mode' + (state.mode === "all" ? "" : " active") + '" id="app-mode" aria-label="앱 모드 선택">' + modeOptions() + '</select></div><div class="app-actions">'
      + iconButton("add", "plus", "예시 계정 추가")
      + (state.device === "mac" ? iconButton("vpn", "globe", "VPN 미리보기") : "")
      + iconButton("settings", "settings", "미리보기 설정") + '</div></div>'
      + (state.device === "mac" && state.vpnConnected ? '<div class="mode-banner">' + icon("shield") + '<p><strong>VPN 연결됨 · 업무 VPN</strong><span>예시 연결 상태</span></p><button type="button" data-app="vpn-toggle">연결 해제</button></div>' : "")
      + '<label class="app-search">' + icon("search") + '<span class="visually-hidden">계정 검색</span><input id="account-search" type="search" placeholder="이름, 아이디, 사이트 검색" value="' + escapeHTML(state.query) + '" autocomplete="off"></label>'
      + (state.mode === "all" ? "" : '<div class="mode-banner"><p><strong>‘' + modeNames[state.mode] + '’ 모드 적용 중 · 계정 ' + visible.length + '개 표시, ' + (accounts.length - visible.length) + '개 숨김</strong><span>브라우저·자동 완성에도 같은 계정만 보입니다</span></p><button type="button" data-app="all-modes">전체 보기</button></div>')
      + '<div class="app-filters"><button type="button" data-filter="all" aria-pressed="' + (state.filter === "all") + '">전체 ' + visible.length + '</button><button type="button" data-filter="pinned" aria-pressed="' + (state.filter === "pinned") + '">고정됨 ' + visible.filter(account => account.pinned).length + '</button><select id="app-group" aria-label="계정 그룹 선택"><option value="">모든 그룹</option>' + groups.map(group => '<option' + (state.group === group ? " selected" : "") + '>' + escapeHTML(group) + '</option>').join("") + '</select></div><ul class="app-accounts" aria-label="예시 계정 목록"></ul>';
    renderAccountList();
  }

  function currentCode() {
    const step = Math.floor(Date.now() / 30000);
    const value = Math.imul(step, 2654435761) >>> 0;
    return String(value % 1000000).padStart(6, "0");
  }

  function renderDetail() {
    const account = accounts.find(account => account.id === state.accountId);
    if (!account) { state.screen = "list"; renderApp(); return; }
    app.innerHTML = subhead("계정 정보", iconButton("pin", "pin", account.pinned ? "고정 해제" : "계정 고정"))
      + '<div class="app-body"><div class="detail-identity">' + avatar(account) + '<div><h3>' + escapeHTML(account.nickname) + '</h3><p>비밀번호 로그인</p></div></div>'
      + '<div class="detail-site">' + icon("globe") + '<span>*.' + escapeHTML(account.site) + '</span></div><div class="credential-card">'
      + '<div class="credential-row"><div class="credential-text"><span>아이디</span><strong>' + escapeHTML(account.loginId) + '</strong></div>' + iconButton("copy-id", "copy", "예시 아이디 복사") + '</div>'
      + '<div class="credential-row"><div class="credential-text"><span>비밀번호</span><strong>' + (state.reveal ? demoPassword : "••••••••••") + '</strong></div>' + iconButton("reveal", "eye", state.reveal ? "비밀번호 가리기" : "비밀번호 보기") + iconButton("copy-password", "copy", "예시 비밀번호 복사") + '</div></div>'
      + (account.totp ? '<div class="otp-card"><div class="otp-card-heading"><span>인증 코드</span><span data-otp-seconds></span></div><div class="otp-code"><span data-otp-code></span>' + iconButton("copy-otp", "copy", "예시 인증 코드 복사") + '</div><small>체험용 코드 · 실제 계정의 인증 코드가 아닙니다</small></div>' : "")
      + '</div>';
    updateOTP();
  }

  function updateOTP() {
    const code = currentCode();
    $$("[data-otp-code]").forEach(element => { element.textContent = code.slice(0, 3) + " " + code.slice(3); });
    $$("[data-otp-seconds]").forEach(element => { element.textContent = (30 - Math.floor(Date.now() / 1000) % 30) + "초"; });
  }
  setInterval(() => { if (!document.hidden) updateOTP(); }, 1000);

  function setMode(value, focusId) {
    state.mode = value;
    closeDropdown();
    $("#browser-mode").value = value;
    if (state.screen === "list") renderApp();
    if (focusId) $("#" + focusId)?.focus({ preventScroll:true });
  }

  app.addEventListener("input", event => {
    if (event.target.id === "account-search") { state.query = event.target.value; renderAccountList(); }
  });
  app.addEventListener("change", event => {
    if (event.target.id === "app-mode") setMode(event.target.value, "app-mode");
    if (event.target.id === "app-group") { state.group = event.target.value; renderAccountList(); }
    if (event.target.id === "app-theme") setTheme(event.target.value);
  });
  app.addEventListener("click", event => {
    const accountButton = event.target.closest("[data-account]");
    const filterButton = event.target.closest("[data-filter]");
    const action = event.target.closest("[data-app]")?.dataset.app;
    if (accountButton) { state.accountId = accountButton.dataset.account; state.screen = "detail"; state.reveal = false; renderApp(); $(".app-subhead button", app)?.focus({ preventScroll:true }); }
    if (filterButton) { state.filter = filterButton.dataset.filter; renderApp(); $('[data-filter="' + state.filter + '"]', app).focus({ preventScroll:true }); }
    if (action === "back") { const previousId = state.accountId; state.screen = "list"; state.reveal = false; renderApp(); ($('[data-account="' + previousId + '"]', app) || $("#app-mode"))?.focus({ preventScroll:true }); }
    if (["add", "settings", "vpn"].includes(action)) { state.screen = action; renderApp(); $(".app-subhead button", app).focus({ preventScroll:true }); }
    if (action === "all-modes") { setMode("all", "app-mode"); }
    if (action === "pin") { const account = accounts.find(account => account.id === state.accountId); account.pinned = !account.pinned; renderApp(); $('[data-app="pin"]', app).focus({ preventScroll:true }); }
    if (action === "reveal") { state.reveal = !state.reveal; renderDetail(); $('[data-app="reveal"]', app).focus({ preventScroll:true }); }
    if (action === "copy-id") copy(accounts.find(account => account.id === state.accountId).loginId, "아이디");
    if (action === "copy-password") copy(demoPassword, "비밀번호");
    if (action === "copy-otp") copy(currentCode(), "인증 코드");
    if (action === "vpn-toggle") { state.vpnConnected = !state.vpnConnected; renderApp(); showToast(state.vpnConnected ? "예시 VPN이 연결되었습니다" : "예시 VPN 연결을 해제했습니다"); }
  });
  app.addEventListener("submit", event => {
    event.preventDefault();
    if (event.target.id !== "add-account-form") return;
    const data = new FormData(event.target);
    const nickname = String(data.get("nickname")).trim();
    if (!nickname) { event.target.elements.nickname.focus(); return; }
    const mode = data.get("mode");
    accounts.push({ id:"demo-" + Date.now(), nickname, loginId:"demo@example.com", site:"example.com", modes:mode ? [mode] : [], groups:[], pinned:false, totp:false });
    state.screen = "list"; state.query = ""; state.group = ""; state.filter = "all";
    if (mode && state.mode !== "all" && state.mode !== mode) setMode(mode);
    renderApp();
    showToast("예시 계정을 추가했습니다");
  });

  function setTheme(value) {
    if (value === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    $("#theme").value = value;
    if ($("#app-theme")) $("#app-theme").value = value;
    try { localStorage.setItem("keyring-site-theme", value); } catch { /* The preference is optional. */ }
  }
  try {
    const preference = localStorage.getItem("keyring-site-theme");
    if (["light", "dark", "system"].includes(preference)) setTheme(preference);
  } catch { /* Use the system appearance when storage is unavailable. */ }
  $("#theme").addEventListener("change", event => setTheme(event.target.value));

  function tabs(container, select) {
    const buttons = $$('[role="tab"]', container);
    function activate(button, focus = false) {
      buttons.forEach(tab => {
        const active = tab === button;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      });
      select(button);
      if (focus) button.focus({ preventScroll:true });
    }
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => activate(button));
      button.addEventListener("keydown", event => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
        if (event.key === "ArrowLeft") next = (index + buttons.length - 1) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        if (next !== undefined) { event.preventDefault(); activate(buttons[next], true); }
      });
    });
  }
  tabs($(".segmented"), button => {
    state.device = button.dataset.device;
    if (state.device === "ios" && state.screen === "vpn") state.screen = "list";
    frame.setAttribute("aria-labelledby", button.id);
    renderApp();
  });
  tabs($(".demo-tabs"), button => {
    closeDropdown();
    resetSave();
    $$(".demo-panel").forEach(panel => { panel.hidden = panel.id !== button.getAttribute("aria-controls"); });
  });

  function closeDropdown(restoreFocus = false) {
    $$(".kr-dropdown").forEach(dropdown => dropdown.remove());
    if (dropdownInput) {
      dropdownInput.setAttribute("aria-expanded", "false");
      dropdownInput.removeAttribute("aria-controls");
      if (restoreFocus) dropdownInput.focus({ preventScroll:true });
    }
    dropdownInput = null;
  }

  function showDropdown(input, items) {
    closeDropdown();
    dropdownInput = input;
    const wrapper = document.createElement("div");
    wrapper.className = "kr-dropdown";
    wrapper.id = "keyring-demo-suggestions";
    wrapper.style.top = (input.closest("label").offsetTop + input.closest("label").offsetHeight + 6) + "px";
    wrapper.innerHTML = '<div class="kr-header">' + icon("key") + '<span>Keyring</span></div><ul aria-label="자동 완성 계정"></ul>';
    const list = $("ul", wrapper);
    items.forEach(item => {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = '<span class="account-text"><strong>' + escapeHTML(item.nickname) + '</strong><span>' + escapeHTML(item.detail) + '</span></span>';
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => { closeDropdown(); item.choose(); });
      button.addEventListener("keydown", event => {
        const buttons = $$("button", wrapper);
        const index = buttons.indexOf(button);
        if (["ArrowDown", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length].focus();
        }
      });
      li.append(button);
      list.append(li);
    });
    input.closest("form").append(wrapper);
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", wrapper.id);
    return wrapper;
  }

  function fillInput(input, value) {
    input.value = value;
    input.classList.remove("filled");
    void input.offsetWidth;
    input.classList.add("filled");
    input.dispatchEvent(new Event("input", { bubbles:true }));
  }

  const fillForm = $('[data-demo="fill"]');
  function openFill(input) {
    return showDropdown(input, modeAccounts().filter(account => account.site === "github.com").map(account => ({
      nickname:account.nickname, detail:account.loginId,
      choose() {
        fillInput(fillForm.elements.username, account.loginId);
        fillInput(fillForm.elements.password, demoPassword);
        $(".form-status", fillForm).textContent = "아이디와 비밀번호를 채웠습니다";
        showToast("아이디와 비밀번호를 채웠습니다");
      },
    })));
  }
  const otpForm = $('[data-demo="otp"]');
  const mailPreview = $(".mail-preview");
  function openOTP() {
    const mail = $("#otp-method").value === "mail";
    const account = modeAccounts().find(account => account.site === (mail ? "notion.so" : "github.com"));
    return showDropdown(otpForm.elements.otp, [{
      nickname:account.nickname,
      detail:account.loginId + (mail ? " · 메일함 열기" : ""),
      choose() {
        if (mail) { otpForm.hidden = true; mailPreview.hidden = false; $("#mail-back").focus({ preventScroll:true }); }
        else { fillInput(otpForm.elements.otp, currentCode()); $(".form-status", otpForm).textContent = "체험용 인증 코드를 채웠습니다"; showToast("인증 코드를 채웠습니다"); }
      },
    }]);
  }

  function bindSuggestions(input, open) {
    input.setAttribute("aria-haspopup", "true");
    input.setAttribute("aria-expanded", "false");
    input.addEventListener("click", () => open(input));
    input.addEventListener("keydown", event => {
      if (["Enter", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        const dropdown = open(input);
        $("button", dropdown).focus({ preventScroll:true });
      }
    });
  }
  $$("input", fillForm).forEach(input => bindSuggestions(input, openFill));
  bindSuggestions(otpForm.elements.otp, openOTP);
  $("#browser-mode").addEventListener("change", event => setMode(event.target.value));
  fillForm.addEventListener("submit", event => {
    event.preventDefault();
    closeDropdown();
    $(".form-status", fillForm).textContent = fillForm.elements.username.value ? "로그인 체험 완료 · 실제 로그인은 하지 않습니다" : "먼저 아이디 칸에서 계정을 골라 주세요";
  });
  otpForm.addEventListener("submit", event => {
    event.preventDefault();
    closeDropdown();
    $(".form-status", otpForm).textContent = otpForm.elements.otp.value ? "인증 체험 완료 · 실제 인증은 하지 않습니다" : "먼저 인증 코드 칸에서 계정을 골라 주세요";
  });

  function resetOTP() {
    otpForm.reset();
    otpForm.hidden = false;
    mailPreview.hidden = true;
    $(".form-status", otpForm).textContent = "";
    closeDropdown();
  }
  $("#mail-back").addEventListener("click", resetOTP);
  $("#otp-method").addEventListener("change", event => {
    resetOTP();
    $("#otp-address").textContent = event.target.value === "mail" ? "notion.so/login" : "github.com/sessions/two-factor";
    $("#otp-hint").textContent = event.target.value === "mail" ? "인증 코드 칸을 누르면 등록한 메일함을 열 수 있습니다." : "인증 코드 칸을 눌러 GitHub 계정을 선택해 보세요.";
  });

  const savePage = $('[data-demo="save"]');
  const saveForm = $("form", savePage);
  const savePrompt = $(".kr-save", savePage);
  const saveWelcome = $(".welcome", savePage);
  function resetSave() {
    clearTimeout(loginTimer);
    saveForm.hidden = false;
    saveWelcome.hidden = true;
    savePrompt.hidden = true;
    $(".form-error", saveForm).hidden = true;
    $("button[type=submit]", saveForm).disabled = false;
    saveForm.removeAttribute("aria-busy");
  }
  function attemptLogin(succeeds) {
    clearTimeout(loginTimer);
    $(".form-error", saveForm).hidden = true;
    saveForm.setAttribute("aria-busy", "true");
    $("button[type=submit]", saveForm).disabled = true;
    loginTimer = setTimeout(() => {
      saveForm.removeAttribute("aria-busy");
      $("button[type=submit]", saveForm).disabled = false;
      if (!succeeds) { $(".form-error", saveForm).hidden = false; return; }
      saveForm.hidden = true;
      saveWelcome.hidden = false;
      if (accounts.some(account => account.id === "linear")) {
        showToast("이미 저장된 계정입니다. 앱 미리보기에서 확인해 보세요.");
      } else {
        savePrompt.hidden = false;
        $('[data-action="store"]', savePrompt).focus({ preventScroll:true });
      }
    }, matchMedia("(prefers-reduced-motion:reduce)").matches ? 0 : 400);
  }
  saveForm.addEventListener("submit", event => { event.preventDefault(); attemptLogin(true); });
  savePage.addEventListener("click", event => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "wrong") attemptLogin(false);
    if (action === "later") { savePrompt.hidden = true; $('[data-reset="save"]').focus({ preventScroll:true }); }
    if (action === "store") {
      if (!accounts.some(account => account.id === "linear")) accounts.push({ id:"linear", nickname:"Linear", loginId:"jamie.kim@example.com", site:"linear.app", modes:["work"], groups:["협업"], pinned:false, totp:false });
      savePrompt.hidden = true;
      if (state.screen === "list") renderApp();
      $('[data-reset="save"]').focus({ preventScroll:true });
      showToast("예시 계정을 저장했습니다. 앱 미리보기에서 Linear를 찾아보세요.");
    }
  });
  $$("[data-reset]").forEach(button => button.addEventListener("click", () => {
    closeDropdown();
    if (button.dataset.reset === "fill") { fillForm.reset(); $(".form-status", fillForm).textContent = ""; }
    if (button.dataset.reset === "otp") resetOTP();
    if (button.dataset.reset === "save") resetSave();
  }));
  document.addEventListener("click", event => {
    if (!event.target.closest(".kr-dropdown, .login input")) closeDropdown();
  });
  document.addEventListener("focusin", event => {
    if (!event.target.closest(".kr-dropdown, .login input")) closeDropdown();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if ($(".kr-dropdown")) { event.preventDefault(); closeDropdown(true); }
    else if (!savePrompt.hidden) { savePrompt.hidden = true; $('[data-reset="save"]').focus({ preventScroll:true }); }
    else if (app.contains(document.activeElement) && state.screen !== "list") { state.screen = "list"; state.reveal = false; renderApp(); $("#app-mode").focus({ preventScroll:true }); }
  });

  const migrations = {
    google:{ format:"계정 전송 QR", note:"여러 장이면 같은 내보내기의 QR을 모두 읽어 주세요.", steps:["Google Authenticator에서 계정 전송 → 내보내기를 선택합니다.", "옮길 계정을 고르고 표시된 QR을 Keyring에서 읽습니다.", "가져올 계정을 확인하고 선택한 계정만 저장합니다."] },
    apple:{ format:"암호 CSV 파일", note:"패스키 등 CSV에 포함되지 않는 항목은 옮겨지지 않습니다.", steps:["Mac 암호 앱의 파일 → 모든 암호를 파일로 내보내기에서 CSV를 준비합니다.", "Keyring의 Apple 암호 가져오기 안내에서 CSV 파일을 선택합니다.", "검색과 체크박스로 가져올 계정을 고른 뒤 저장합니다."] },
    chrome:{ format:"비밀번호 CSV 파일", note:"컴퓨터 브라우저의 비밀번호 관리자에서 내보냅니다.", steps:["브라우저의 비밀번호 관리자 → 설정에서 비밀번호를 내보냅니다.", "Keyring에서 내려받은 CSV 파일을 선택합니다.", "가져올 계정을 확인하고 선택한 계정만 저장합니다."] },
    keepass:{ format:"암호화된 KDBX 파일", note:"원본을 수정하지 않고 읽습니다. 먼저 복사본을 준비하세요.", steps:["KeePass 또는 KeePassXC 데이터베이스의 복사본을 준비합니다.", "Keyring에서 KDBX 파일을 선택하고 마스터 암호를 입력합니다.", "가져올 계정을 골라 저장합니다. 다른 앱 계정은 설정에서 추가로 가져올 수 있습니다."] },
  };
  $("#migration-source").addEventListener("change", event => {
    const guide = migrations[event.target.value];
    $("#migration-format").textContent = guide.format;
    $("#migration-note").textContent = guide.note;
    $("#migration-steps").replaceChildren(...guide.steps.map(text => { const li = document.createElement("li"); li.textContent = text; return li; }));
  });

  async function updateReleaseInfo() {
    try {
      const response = await fetch("appcast.xml", { cache:"no-cache" });
      if (!response.ok) return;
      const xml = new DOMParser().parseFromString(await response.text(), "application/xml");
      const read = (name) => xml.getElementsByTagNameNS("http://www.andymatuschak.org/xml-namespaces/sparkle", name)[0]?.textContent?.trim();
      const version = read("shortVersionString");
      const build = read("version");
      const minimum = read("minimumSystemVersion");
      if (/^\d+(\.\d+){1,3}$/.test(version || "") && /^\d+$/.test(build || "")) $$("[data-mac-version]").forEach(element => { element.textContent = version + " (" + build + ")"; });
      if (/^\d+(\.\d+){1,3}$/.test(minimum || "")) $$("[data-mac-os]").forEach(element => { element.textContent = "macOS " + minimum + " 이상"; });
    } catch { /* The current release remains visible when the feed is unavailable. */ }
  }

  renderApp();
  updateReleaseInfo();
})();
