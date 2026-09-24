import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';

export interface DoormatItem {
  path?: string;
  titleKey: string;
  descriptionKey: string;
  isExternal?: boolean;
  hideInProd?: boolean;
}

// Complete doormat list (so we only have to maintain 1 source)
export const DOORMATS = {
  //Project
  dashboard: { path: '/project/dashboard', titleKey: 'dashboard._title', descriptionKey: 'dashboard.description' },
  editProject: { path: '/project/edit', titleKey: 'project._nav.edit', descriptionKey: 'project.edit.description' },
  newProject: { path: '/project/new', titleKey: 'project._nav.new', descriptionKey: 'project.new.description' },
  switchProject: { path: '/project/switch', titleKey: 'switch._title', descriptionKey: 'switch.description' },
  //Tasks
  addPages: { path: '/tasks/add-pages', titleKey: 'addPages._nav', descriptionKey: 'addPages.description' },
  search: { path: undefined, titleKey: 'search._nav', descriptionKey: 'search.description', hideInProd: true },
  problems: { path: undefined, titleKey: 'problems._nav', descriptionKey: 'problems.description', hideInProd: true },
  iaDiagram: { path: '/tasks/ia-diagram', titleKey: 'iaDiagram._title', descriptionKey: 'iaDiagram.description' },
  inventory: { path: '/tasks/inventory', titleKey: 'inventory._nav', descriptionKey: 'inventory.description' },
  exportPages: { path: '/tasks/export-pages', titleKey: 'exportPages._nav', descriptionKey: 'exportPages.description' },
  editPages: { path: '/tasks/edit-pages', titleKey: 'editPages._nav', descriptionKey: 'editPages.description' },
  compare: { path: '/tasks/compare', titleKey: 'compare._nav', descriptionKey: 'compare.description' },
  //Standalone
  standaloneCompare: { path: '/standalone/compare', titleKey: 'compare._nav', descriptionKey: 'compare.description' },
  //Dev
  monitoring: { path: '/dev/monitoring', titleKey: 'dev.monitoring._title', descriptionKey: 'dev.monitoring.description' },
  colors: { path: '/dev/color-generator', titleKey: 'dev.colors._title', descriptionKey: 'dev.colors.description' },
  patterns: { path: '/dev/design-patterns', titleKey: 'dev.patterns._title', descriptionKey: 'dev.patterns.description' },
  prompts: { path: '/dev/prompt-editor', titleKey: 'dev.prompts._title', descriptionKey: 'dev.prompts.description' },
  //External
  ucdgDiscover: { path: 'ucdg.discover.link', titleKey: 'ucdg.discover.title', descriptionKey: 'ucdg.discover.description', isExternal: true },
} as const satisfies Record<string, DoormatItem>;

export type DoormatKey = keyof typeof DOORMATS;

@Component({
  selector: 'aida-doormats',
  imports: [RouterLink, TranslatePipe],
  templateUrl: './doormats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoormatsComponent {
  protected readonly prod = environment.production;
  protected readonly items = DOORMATS;
  public readonly keys = input.required<DoormatKey[]>();

  protected isHiddenInProd(key: DoormatKey): boolean {
    return !!(this.items[key] as DoormatItem).hideInProd;
  }

  protected isExternal(key: DoormatKey): boolean {
    return !!(this.items[key] as DoormatItem).isExternal;
  }

  markForTranslation() {
    marker('search._nav');
    marker('search.description');
    marker('problems._nav');
    marker('problems.description');
    marker('iaDiagram.description');
    marker('compare.description');
    marker('ucdg.discover.description');
    marker('ucdg.discover.link');
    marker('ucdg.discover.title');
  }
}
