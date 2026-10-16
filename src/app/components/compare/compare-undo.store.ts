import { computed, signal } from '@angular/core';

import { htmlProcessingResult } from '../../services/html-normalization.service';

export interface DiffSnapshot {
  beforeContent: htmlProcessingResult;
  afterContent: htmlProcessingResult;
}

export class DiffUndoStack {
  private readonly maxSize = 10; // adjust for however many undo's we want to allow
  private readonly stack = signal<DiffSnapshot[]>([]);

  readonly canUndo = computed(() => this.stack().length > 0);

  push(snapshot: DiffSnapshot): void {
    this.stack.update((s) => {
      const next = [...s, snapshot];
      return next.length > this.maxSize ? next.slice(next.length - this.maxSize) : next;
    });
  }

  pop(): DiffSnapshot | undefined {
    const current = this.stack();
    if (current.length === 0) return undefined;
    const last = current[current.length - 1];
    this.stack.set(current.slice(0, -1));
    return last;
  }

  clear(): void {
    this.stack.set([]);
  }
}
