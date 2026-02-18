const SQUARE_API_BASE = "https://connect.squareup.com/v2";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function squareFetch(path: string, init: RequestInit) {
  const token = requireEnv("SQUARE_ACCESS_TOKEN");
  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || `Square API error (${res.status})`;
    throw new Error(`${msg} :: ${path}`);
  }

  return json;
}
