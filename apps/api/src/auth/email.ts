import net from "node:net";
import tls from "node:tls";

type VerificationEmailParams = {
  to: string;
  username: string;
  verifyUrl: string;
};

type SmtpSocket = net.Socket | tls.TLSSocket;

const SMTP_TIMEOUT_MS = 15000;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function escapeSmtpData(message: string): string {
  return message
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function extractAddress(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim();
}

function readSmtpResponse(socket: SmtpSocket): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("SMTP response timed out"));
    }, SMTP_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
    }

    function onError(error: Error) {
      cleanup();
      reject(error);
    }

    function onData(chunk: Buffer) {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1];

      if (lastLine && /^\d{3} /.test(lastLine)) {
        cleanup();
        resolve(buffer);
      }
    }

    socket.on("data", onData);
    socket.on("error", onError);
  });
}

async function sendCommand(
  socket: SmtpSocket,
  command: string,
  expectedCodes: number[]
): Promise<string> {
  socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  const code = Number(response.slice(0, 3));

  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed (${command}): ${response.trim()}`);
  }

  return response;
}

function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    });
    socket.once("error", reject);
  });
}

function connectSecure(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.setTimeout(SMTP_TIMEOUT_MS);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP TLS connection timed out"));
    });
    socket.once("error", reject);
  });
}

function upgradeToTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  socket.removeAllListeners("timeout");
  socket.removeAllListeners("error");

  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => {
      resolve(secureSocket);
    });
    secureSocket.setTimeout(SMTP_TIMEOUT_MS);
    secureSocket.once("timeout", () => {
      secureSocket.destroy();
      reject(new Error("SMTP STARTTLS connection timed out"));
    });
    secureSocket.once("error", reject);
  });
}

async function sendSmtpMail(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = env("SMTP_HOST");
  const from = params.from;

  if (!host) {
    throw new Error("SMTP_HOST is not set");
  }

  const secure = env("SMTP_SECURE") === "true";
  const port = Number(env("SMTP_PORT") ?? (secure ? "465" : "587"));
  const username = env("SMTP_USER");
  const password = env("SMTP_PASS");
  let socket: SmtpSocket = secure
    ? await connectSecure(host, port)
    : await connectPlain(host, port);

  try {
    const greeting = await readSmtpResponse(socket);
    if (Number(greeting.slice(0, 3)) !== 220) {
      throw new Error(`Unexpected SMTP greeting: ${greeting.trim()}`);
    }

    const ehloHost = env("SMTP_EHLO_HOST") ?? "localhost";
    const ehloResponse = await sendCommand(socket, `EHLO ${ehloHost}`, [250]);

    if (!secure && env("SMTP_STARTTLS") !== "false" && ehloResponse.includes("STARTTLS")) {
      await sendCommand(socket, "STARTTLS", [220]);
      socket = await upgradeToTls(socket as net.Socket, host);
      await sendCommand(socket, `EHLO ${ehloHost}`, [250]);
    }

    if (username && password) {
      await sendCommand(socket, "AUTH LOGIN", [334]);
      await sendCommand(socket, Buffer.from(username).toString("base64"), [334]);
      await sendCommand(socket, Buffer.from(password).toString("base64"), [235]);
    }

    const message = [
      `From: ${from}`,
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      params.text,
    ].join("\r\n");

    await sendCommand(socket, `MAIL FROM:<${extractAddress(from)}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${extractAddress(params.to)}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${escapeSmtpData(message)}\r\n.\r\n`);

    const dataResponse = await readSmtpResponse(socket);
    const dataCode = Number(dataResponse.slice(0, 3));
    if (dataCode !== 250) {
      throw new Error(`SMTP DATA failed: ${dataResponse.trim()}`);
    }

    await sendCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
  }
}

export async function sendVerificationEmail({
  to,
  username,
  verifyUrl,
}: VerificationEmailParams): Promise<void> {
  const smtpFrom = env("SMTP_FROM");

  if (!env("SMTP_HOST") || !smtpFrom) {
    console.info("Email provider is not configured. Verification link:");
    console.info(verifyUrl);
    return;
  }

  await sendSmtpMail({
    from: smtpFrom,
    to,
    subject: "Fantasy Book email verification",
    text: [
      `Здравствуй, ${username}.`,
      "",
      "Чтобы подтвердить почту в Fantasy Book, открой ссылку:",
      verifyUrl,
      "",
      "Если ты не создавал аккаунт, просто проигнорируй это письмо.",
    ].join("\n"),
  });
}
