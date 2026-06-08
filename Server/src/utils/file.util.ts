import path from "path";

export function generateImageName(
  entityName: string | undefined | null,
  originalName: string | undefined | null,
  lastTimestampRef: { value: number }
) {
  const name = (entityName ?? "file").toString();
  const orig = (originalName ?? "file").toString();
  const ext = path.extname(orig);

  const cleanName = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const cleanOriginal = path
    .basename(orig, ext)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  let now = Date.now();
  if (now <= lastTimestampRef.value) now = lastTimestampRef.value + 1;
  lastTimestampRef.value = now;

  return `${now}-${cleanName}-${cleanOriginal}${ext}`;
}

