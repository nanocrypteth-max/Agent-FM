/** MM/dd/yyyy */
export function fmtDate(iso: string | Date): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
/** MM/dd/yyyy HH:mm */
export function fmtDateTime(iso: string | Date): string {
  const d = new Date(iso);
  return `${fmtDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
