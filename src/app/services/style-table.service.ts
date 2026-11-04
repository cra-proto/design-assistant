import { computed, DestroyRef, effect, ElementRef, inject, Injectable, signal, Signal, untracked, WritableSignal } from '@angular/core';

import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { TreeNode } from 'primeng/api';

import { ProjectStateService } from '../services/project-state.service';
import { StyleTreeNodeService } from '../services/style-treenode.service';
import { ProjectCacheService } from './project-cache.service';

import { TreeNodeData } from '../common/data.model';

/** Add any utilities used by tables to this file */

export interface LabelItem {
  h1: string;
  doubleH1: string;
  path: string;
}

/** Returns group name and how many columns are spanned by that group */
export function groupSpans(cols: { group: string }[]) {
  const result: { name: string; span: number }[] = [];
  for (const { group } of cols) {
    const last = result.at(-1);
    if (last?.name === group) last.span++;
    else result.push({ name: group, span: 1 });
  }
  return result;
}

/** Returns an array of how many rows can be displayed per page for a given page total */
export function rowsPerPageOptions(pageTotal: number) {
  return [25, 50, 100].filter((n) => n < pageTotal).concat(pageTotal);
}

/** Tracks if sticky content is currently stuck (for adding classes with hover effects) */
export function trackStuck() {
  const host = inject<ElementRef<HTMLElement>>(ElementRef);
  const stuckX = signal(false);
  const stuckY = signal(false);

  const update = () => {
    const th = host.nativeElement.querySelector<HTMLElement>('th.sticky-table-column');
    if (!th) return;
    const rect = th.getBoundingClientRect();
    const style = getComputedStyle(th);
    stuckX.set(rect.left <= (parseFloat(style.left) || 0) + 0.5);
    stuckY.set(rect.top <= (parseFloat(style.top) || 0) + 0.5);
  };

  document.addEventListener('scroll', update, { capture: true, passive: true });
  window.addEventListener('resize', update, { passive: true });
  inject(DestroyRef).onDestroy(() => {
    document.removeEventListener('scroll', update, { capture: true });
    window.removeEventListener('resize', update);
  });

  return { stuckX, stuckY };
}

/** Build filter fields for currently visible columns plus h1, double h1, and path */
export function buildFilterFields(lang: 'en' | 'fr', columns: { key: string }[]) {
  return [`label.${lang}.h1`, `label.${lang}.doubleH1`, `label.${lang}.path`, ...columns.map((c) => `${c.key}.content`)];
}

/** Tracks selected table rows and maps them to selected nodes */
export function createRowSelection<T extends { label: Record<'en' | 'fr', LabelItem> }>(rows: Signal<T[]>) {
  const projectState = inject(ProjectStateService);
  const projectCache = inject(ProjectCacheService);

  const selectedRows = signal<T[]>([]);

  const selectedNodes = computed(() =>
    projectState.findNodesByPaths(
      projectState.getProject().projectData,
      selectedRows().map((r) => r.label[projectCache.uiLang()].path),
      projectCache.uiLang(),
    ),
  );

  // Keep the selection pointing at the current row objects when rows() rebuilds
  effect(() => {
    void rows();
    untracked(() => {
      const selected = selectedRows();
      if (selected.length === 0) return;

      const byPath = new Map(rows().map((r) => [r.label.en.path, r]));
      const next = selected.map((r) => byPath.get(r.label.en.path)).filter((r): r is T => !!r);

      const unchanged = next.length === selected.length && next.every((r, i) => r === selected[i]);
      if (!unchanged) selectedRows.set(next);
    });
  });

  return { selectedRows, selectedNodes };
}

/** Restores a signal saved to localStorage as a string if the stored value is allowed */
export function persisted<T extends string>(storageKey: string, state: WritableSignal<T | undefined>, allowed: readonly T[]) {
  return {
    save: () => {
      const value = state();
      if (value === undefined) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, value);
    },
    restore: () => {
      const value = localStorage.getItem(storageKey);
      if (value !== null && (allowed as readonly string[]).includes(value)) state.set(value as T);
    },
  };
}

/** Add any column visibility functions to this class */
export class ColumnVisibility {
  readonly hidden = signal<ReadonlySet<string>>(new Set());

  constructor(
    private readonly storageKey: string,
    private readonly extras: { save: () => void; restore: () => void }[] = [],
  ) {}

  isVisible(key: string) {
    return !this.hidden().has(key);
  }

  groupState(cols: { key: string }[]): 'all' | 'some' | 'none' {
    const n = cols.filter((c) => this.isVisible(c.key)).length;
    return n === 0 ? 'none' : n === cols.length ? 'all' : 'some';
  }

  setGroup(cols: { key: string }[], visible: boolean) {
    this.hidden.update((s) => {
      const next = new Set(s);
      for (const { key } of cols) {
        if (visible) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  setColumn(key: string, visible: boolean) {
    this.setGroup([{ key }], visible);
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.hidden()]));
      this.extras.forEach((e) => e.save());
    } catch {
      console.error('Could not save column settings');
    }
  }

  restore() {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? 'null');
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
        this.hidden.set(new Set(parsed));
      }
      this.extras.forEach((e) => e.restore());
    } catch {
      console.error('Could not restore column settings');
    }
  }
}

@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  private readonly styleTreeNodeService = inject(StyleTreeNodeService);

  private static readonly ENTRIES = [
    { flag: 'isNew', style: 'new', text: marker('editNode.isNew') },
    { flag: 'isMoved', style: 'move', text: marker('editNode.isMoved') },
    { flag: 'isROT', style: 'rot', text: marker('editNode.isROT') },
  ] as const;

  /** Get dynamic legend items */
  public legendItems(): { context: string[]; text: string }[] {
    const tree = this.projectState.getProject().projectData;
    if (tree.length === 0) return [];

    const colours = this.styleTreeNodeService.contextStyles;
    return TableService.ENTRIES.filter(({ flag }) => this.projectState.findNodeWhere(tree, (n) => n.data?.status?.[flag] === true) !== null).map(({ style, text }) => ({
      context: [colours[style].replace('border-dashed', '')],
      text,
    }));
  }

  /** Lookup node for a given row label */
  public getNode(label: Record<'en' | 'fr', LabelItem>): TreeNode<TreeNodeData>[] | undefined {
    const lang = this.projectCache.uiLang();
    const node = this.projectState.findNodeByPath(this.projectState.getProject().projectData, label[lang].path, lang);
    return node ? [node] : undefined;
  }
}
