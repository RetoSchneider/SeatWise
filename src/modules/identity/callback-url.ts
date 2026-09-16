export function safeCallbackUrl(value?: string) {
  if (!value?.startsWith("/")) return "/account";
  const origin = "http://seatwise.local";
  try {
    const url = new URL(value, origin);
    return url.origin === origin
      ? `${url.pathname}${url.search}${url.hash}`
      : "/account";
  } catch {
    return "/account";
  }
}
