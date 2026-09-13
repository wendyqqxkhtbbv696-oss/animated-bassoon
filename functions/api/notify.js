function getClientIp(request) {
  const headers = [
    "CF-Connecting-IP",
    "X-Forwarded-For",
    "X-Real-IP",
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (!value) {
      continue;
    }

    const ip = header === "X-Forwarded-For" ? value.split(",")[0].trim() : value.trim();
    if (ip) {
      return ip;
    }
  }

  return "unknown";
}

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) {
    return "";
  }

  const code = countryCode.toUpperCase();
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  );
}

async function resolveGeo(ip, request) {
  if (ip === "unknown" || ip === "127.0.0.1" || ip === "::1") {
    return { country: "Local", countryCode: "" };
  }

  const cfCountry = request.cf?.country;
  if (cfCountry) {
    const countryNames = new Intl.DisplayNames(["ru"], { type: "region" });
    return {
      country: countryNames.of(cfCountry) || cfCountry,
      countryCode: cfCountry,
    };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode`,
      { signal: AbortSignal.timeout(4000) }
    );
    const data = await response.json();
    if (data.status === "success") {
      return {
        country: data.country || "Unknown",
        countryCode: data.countryCode || "",
      };
    }
  } catch {
    // ignore geo lookup errors
  }

  return { country: "Unknown", countryCode: "" };
}

function parseChatIds(raw) {
  return String(raw || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

async function sendTelegramMessage(botToken, chatId, text) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const data = await response.json();
  return Boolean(data.ok);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const botToken = (env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatIds = parseChatIds(env.TELEGRAM_CHAT_ID);

  if (!botToken || chatIds.length === 0) {
    return Response.json({ ok: false, error: "Telegram not configured" }, { status: 500 });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const isWindows = Boolean(input?.isWindows);
  const deviceInfo = String(input?.deviceInfo || input?.fingerprint || "unknown").trim();
  const ip = getClientIp(request);
  const geo = await resolveGeo(ip, request);
  const flag = countryCodeToFlag(geo.countryCode);

  const title = isWindows
    ? "переход с Windows✅"
    : "Переход не с Windows❌";

  const message = [
    title,
    `Страна: ${flag ? `${flag} ` : ""}${geo.country}`,
    `фингер принт: ${deviceInfo}`,
    `IP: ${ip}`,
  ].join("\n");

  const results = await Promise.all(
    chatIds.map((chatId) => sendTelegramMessage(botToken, chatId, message))
  );
  const telegramOk = results.some(Boolean);

  return Response.json(
    {
      ok: telegramOk,
      ip,
      country: geo.country,
      countryCode: geo.countryCode,
      flag,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
