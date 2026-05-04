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
  let json: { errors?: Array<{ detail?: string; code?: string }>; raw?: string } | null = null;
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

export async function deleteSquareCatalogObjects(objectIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(objectIds.filter((id): id is string => Boolean(id?.trim()))));
  if (!ids.length) {
    return { deleted_object_ids: [] as string[] };
  }

  const result = (await squareFetch("/catalog/batch-delete", {
    method: "POST",
    body: JSON.stringify({
      object_ids: ids,
    }),
  })) as { deleted_object_ids?: unknown };

  return {
    deleted_object_ids: Array.isArray(result?.deleted_object_ids)
      ? result.deleted_object_ids.filter((id): id is string => typeof id === "string")
      : [],
  };
}
