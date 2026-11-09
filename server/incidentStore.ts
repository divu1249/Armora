import fs from 'node:fs';
import path from 'node:path';
import type { Incident } from './types.ts';

/**
 * Incident store with JSONL persistence. Every upsert appends the full incident (last line per id
 * wins when loading), so a restart keeps incidents. Seeded sample incidents are transient (never
 * written to disk).
 */
export class IncidentStore {
  private map = new Map<string, Incident>();
  private dir: string | null;
  public badLinesAtLoad = 0;

  constructor(opts: { dir?: string | null } = {}) {
    this.dir = opts.dir ?? null;
    if (this.dir) {
      fs.mkdirSync(this.dir, { recursive: true });
      this.load();
    }
  }

  private get file(): string | null {
    return this.dir ? path.join(this.dir, 'incidents.jsonl') : null;
  }

  private load(): void {
    const f = this.file;
    if (!f || !fs.existsSync(f)) return;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        const inc = JSON.parse(line) as Incident;
        if (inc && typeof inc.id === 'string') this.map.set(inc.id, inc);
      } catch {
        this.badLinesAtLoad++;
      }
    }
  }

  public upsert(incident: Incident): void {
    this.map.set(incident.id, incident);
    if (this.file && !incident.isSeeded) fs.appendFileSync(this.file, JSON.stringify(incident) + '\n');
  }

  /** In-memory only (seeded samples). */
  public setTransient(incident: Incident): void {
    this.map.set(incident.id, incident);
  }

  public get(id: string): Incident | undefined {
    return this.map.get(id);
  }

  public all(): Incident[] {
    return Array.from(this.map.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public reset(): void {
    this.map.clear();
    const f = this.file;
    if (f && fs.existsSync(f)) fs.renameSync(f, `${f}.archived-${Date.now()}`);
  }
}
