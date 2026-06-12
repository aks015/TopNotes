import { Injectable } from '@angular/core';

export interface ReadingEntry {
  noteId: number;
  title: string;
  subject?: string;
  lastPage: number;
  totalPages: number;
  updatedAt: number;
}

/**
 * Tracks recently-opened notes for the "Continue Reading" strip (localStorage).
 * record() dedupes by noteId and moves the entry to the front, so opening the
 * same note updates it in place — never a duplicate / stale entry.
 */
@Injectable({ providedIn: 'root' })
export class ReadingProgressService {
  private readonly KEY = 'tn_reading';
  private readonly MAX = 8;

  list(): ReadingEntry[] {
    try {
      const raw = localStorage.getItem(this.KEY);
      const arr = raw ? (JSON.parse(raw) as ReadingEntry[]) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  /** Last page the buyer reached for a note (for resume). Defaults to page 1. */
  pageFor(noteId: number): number {
    return this.list().find((e) => e.noteId === noteId)?.lastPage ?? 1;
  }

  /** Insert or update: dedupe by noteId, move to front, cap the list. */
  record(entry: Omit<ReadingEntry, 'updatedAt'>): void {
    const next = this.list().filter((e) => e.noteId !== entry.noteId);
    next.unshift({ ...entry, updatedAt: Date.now() });
    this.save(next.slice(0, this.MAX));
  }

  remove(noteId: number): void {
    this.save(this.list().filter((e) => e.noteId !== noteId));
  }

  private save(list: ReadingEntry[]): void {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list));
    } catch {
      /* ignore storage quota errors */
    }
  }
}
