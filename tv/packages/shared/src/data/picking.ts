import { pickViewer } from '@courtside/core';

/** Pick or unpick a viewer; picking a 4th returns the core's limit message and keeps the list (R-09). */
export function togglePick(present: string[], name: string): { present: string[]; message?: string } {
  if (present.includes(name)) return { present: present.filter(n => n !== name) };
  const r = pickViewer(present, name);
  return r.ok ? { present: r.present } : { present, message: r.message };
}

/** Who is watching until someone picks by hand: everyone in order, up to the core's limit (R-09). */
export function defaultPick(names: string[]): string[] {
  return names.reduce<string[]>((present, n) => {
    const r = pickViewer(present, n);
    return r.ok ? r.present : present;
  }, []);
}

/** The selection the Replay screen starts from; set by the Who's watching screen. */
export const selection: { names: string[] } = { names: ['Leo', 'Ana', 'Raul'] };
