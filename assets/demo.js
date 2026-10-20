(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accounts = [
    { nickname: "GitHub", loginId: "jamie.kim", site: "github.com" },
    { nickname: "Google", loginId: "jamie.kim@example.com", site: "google.com" },
    { nickname: "Figma", loginId: "jamie.kim@example.com", site: "figma.com" },
    { nickname: "Slack", loginId: "jamie@example.com", site: "slack.com" },
    { nickname: "AWS", loginId: "jamie-admin", site: "signin.aws.amazon.com" },
    { nickname: "Kakao", loginId: "jamie.kim@example.com", site: "kakao.com" },
    { nickname: "Apple", loginId: "jamie.kim@icloud.com", site: "apple.com" },
  ];

  const toast = document.querySelector(".toast");
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));
  }

  async function type(input, value) {
    input.value = "";
    for (const character of value) {
      input.value += character;
      if (!reduceMotion) await wait(input.type === "password" ? 18 : 28);
    }
    input.classList.remove("filled");
    void input.offsetWidth;
    input.classList.add("filled");
  }

  function avatarColor(identity) {
    const colors = ["#17737d", "#3b66b0", "#785cad", "#a36933", "#a65270", "#576b80"];
    let hash = 0;
    for (const byte of new TextEncoder().encode(identity.toLowerCase())) hash = (hash * 31 + byte) >>> 0;
    return colors[hash % colors.length];
  }

  function closeDropdowns() {
    document.querySelectorAll(".kr-dropdown").forEach((dropdown) => dropdown.remove());
  }

  function showDropdown(input, items) {
    closeDropdowns();
    const label = input.closest("label");
    const list = document.createElement("ul");
    list.className = "kr-dropdown";
    list.style.top = `${label.offsetTop + label.offsetHeight + 4}px`;
    list.innerHTML = '<div class="kr-brand">Keyring</div>';
    for (const item of items) {
      const entry = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.append(...item.content());
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        closeDropdowns();
        item.choose();
      });
      entry.append(button);
      list.append(entry);
    }
    label.after(list);
    list.querySelector("button").focus({ preventScroll: true });
  }

  function textBlock(title, detail) {
    const block = document.createElement("div");
    const nickname = document.createElement("div");
    nickname.className = "nickname";
    nickname.textContent = title;
    const line = document.createElement("div");
    line.className = "detail";
    line.textContent = detail;
    block.append(nickname, line);
    return block;
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".kr-dropdown, .login input")) closeDropdowns();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdowns();
  });

  const fillForm = document.querySelector('[data-demo="fill"]');
  const fillAccounts = [
    { nickname: "GitHub", loginId: "jamie.kim", password: "demo-password-1" },
    { nickname: "GitHub 업무용", loginId: "jamie-work", password: "demo-password-2" },
  ];
  for (const input of fillForm.querySelectorAll("input")) {
    const open = () => showDropdown(input, fillAccounts.map((account) => ({
      content: () => [textBlock(account.nickname, account.loginId)],
      choose: async () => {
        await type(fillForm.elements.id, account.loginId);
        await type(fillForm.elements.password, account.password);
        showToast("아이디와 비밀번호를 채웠습니다");
      },
    })));
    input.addEventListener("click", open);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "ArrowDown") open();
    });
  }

  const savePage = document.querySelector('[data-demo="save"]');
  const saveForm = savePage.querySelector("form");
  const savePrompt = savePage.querySelector(".kr-save");
  const welcome = savePage.querySelector(".welcome");
  const error = savePage.querySelector(".error");
  const submit = saveForm.querySelector(".submit");
  let isSaved = false;

  async function attemptLogin(succeeds) {
    error.hidden = true;
    submit.setAttribute("aria-busy", "true");
    await wait(700);
    submit.removeAttribute("aria-busy");
    if (!succeeds) {
      error.hidden = false;
      return;
    }
    saveForm.hidden = true;
    welcome.hidden = false;
    await wait(500);
    if (isSaved) {
      showToast("이미 저장된 계정이라 묻지 않습니다");
      return;
    }
    savePrompt.hidden = false;
    savePrompt.querySelector(".kr-primary").focus({ preventScroll: true });
  }

  savePage.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "login") attemptLogin(true);
    if (action === "wrong") attemptLogin(false);
    if (action === "later") savePrompt.hidden = true;
    if (action === "store") {
      savePrompt.hidden = true;
      isSaved = true;
      accounts.push({ nickname: "Notion", loginId: "jamie.kim@example.com", site: "notion.so" });
      renderAccounts();
      showToast("Keyring 에 저장했습니다. 메뉴 막대 탭에서 확인해 보세요");
    }
  });

  function resetSave() {
    saveForm.hidden = false;
    welcome.hidden = true;
    savePrompt.hidden = true;
    error.hidden = true;
  }

  const otpForm = document.querySelector('[data-demo="otp"]');
  const otpInput = otpForm.elements.otp;
  const period = 30;

  function currentCode() {
    const step = Math.floor(Date.now() / 1000 / period);
    let value = (step * 2654435761) >>> 0;
    value = (value ^ (value >>> 15)) * 2246822519 >>> 0;
    return String(value % 1000000).padStart(6, "0");
  }

  function secondsLeft() {
    return period - (Math.floor(Date.now() / 1000) % period);
  }

  function ring() {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("class", "ring");
    svg.setAttribute("aria-hidden", "true");
    for (const name of ["track", "left"]) {
      const circle = document.createElementNS(namespace, "circle");
      circle.setAttribute("cx", "10");
      circle.setAttribute("cy", "10");
      circle.setAttribute("r", "8");
      circle.setAttribute("class", name);
      svg.append(circle);
    }
    return svg;
  }

  function updateCodes() {
    const circumference = 2 * Math.PI * 8;
    for (const code of document.querySelectorAll(".kr-dropdown .code")) code.textContent = currentCode();
    for (const left of document.querySelectorAll(".kr-dropdown .ring .left")) {
      left.setAttribute("stroke-dasharray", `${circumference}`);
      left.setAttribute("stroke-dashoffset", `${circumference * (1 - secondsLeft() / period)}`);
    }
  }
  setInterval(updateCodes, 1000);

  function openOTP() {
    showDropdown(otpInput, [{
      content: () => {
        const code = document.createElement("span");
        code.className = "code";
        return [textBlock("GitHub", "jamie.kim"), code, ring()];
      },
      choose: async () => {
        await type(otpInput, currentCode());
        showToast("인증 코드를 채웠습니다");
      },
    }]);
    updateCodes();
  }
  otpInput.addEventListener("click", openOTP);
  otpInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "ArrowDown") openOTP();
  });

  const menuButton = document.querySelector(".menubar-item");
  const popover = document.querySelector(".popover");
  const search = popover.querySelector("input");
  const list = popover.querySelector(".accounts");
  const empty = popover.querySelector(".empty");

  function renderAccounts() {
    const keyword = search.value.trim().toLowerCase();
    const visible = accounts.filter((account) =>
      [account.nickname, account.loginId, account.site].some((field) => field.toLowerCase().includes(keyword)));
    popover.querySelector('[data-count="all"]').textContent = accounts.length;
    list.replaceChildren(...visible.map((account) => {
      const item = document.createElement("li");
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = account.nickname[0];
      avatar.style.background = avatarColor(account.site);
      const text = textBlock(account.nickname, account.loginId);
      text.className = "account-text";
      const copy = document.createElement("button");
      copy.type = "button";
      copy.className = "copy";
      copy.textContent = "아이디 복사";
      copy.setAttribute("aria-label", `${account.nickname} 아이디 복사`);
      copy.addEventListener("click", () => {
        navigator.clipboard?.writeText(account.loginId).catch(() => {});
        showToast(`${account.nickname} 아이디를 복사했습니다`);
      });
      item.append(avatar, text, copy);
      return item;
    }));
    empty.hidden = visible.length > 0;
  }

  function setPopover(isOpen) {
    popover.hidden = !isOpen;
    menuButton.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) search.focus({ preventScroll: true });
  }
  menuButton.addEventListener("click", () => setPopover(popover.hidden));
  search.addEventListener("input", renderAccounts);
  renderAccounts();

  const resets = {
    fill: () => {
      for (const input of fillForm.querySelectorAll("input")) input.value = "";
    },
    save: resetSave,
    otp: () => { otpInput.value = ""; },
  };
  document.querySelectorAll("[data-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      closeDropdowns();
      resets[button.dataset.reset]();
    });
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function selectTab(tab) {
    closeDropdowns();
    for (const other of tabs) {
      const isSelected = other === tab;
      other.setAttribute("aria-selected", String(isSelected));
      other.tabIndex = isSelected ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !isSelected;
    }
    if (tab.id === "tab-menu" && popover.hidden) {
      menuButton.classList.remove("pulse");
      void menuButton.offsetWidth;
      menuButton.classList.add("pulse");
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      selectTab(next);
    });
  });
})();
