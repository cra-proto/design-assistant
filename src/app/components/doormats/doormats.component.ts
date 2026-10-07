import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { UserSettingsService } from '../../services/user-settings.service';

import { environment } from '../../../environments/environment';

export interface DoormatItem {
  path?: string;
  titleKey: string;
  descriptionKey: string;
  icon?: string;
  notOutlined?: boolean;
  isExternal?: boolean;
  hideInProd?: boolean;
}

// Complete doormat list (so we only have to maintain 1 source)
export const DOORMATS = {
  //Project
  dashboard: { path: '/project/dashboard', titleKey: 'dashboard._title', descriptionKey: 'dashboard.description', icon: 'view_quilt' },
  editProject: { path: '/project/edit', titleKey: 'project._nav.edit', descriptionKey: 'project.edit.description', icon: 'edit' },
  newProject: { path: '/project/new', titleKey: 'project._nav.new', descriptionKey: 'project.new.description', icon: 'add' },
  switchProject: { path: '/project/switch', titleKey: 'switch._title', descriptionKey: 'switch.description', icon: 'folder_open' },
  //Tasks
  addPages: { path: '/tasks/add-pages', titleKey: 'addPages._nav', descriptionKey: 'addPages.description', icon: 'note_add' },
  search: { path: undefined, titleKey: 'search._nav', descriptionKey: 'search.description', icon: 'manage_search', hideInProd: true },
  problems: { path: undefined, titleKey: 'problems._nav', descriptionKey: 'problems.description', icon: 'troubleshoot', hideInProd: true },
  iaDiagram: { path: '/tasks/ia-diagram', titleKey: 'iaDiagram._title', descriptionKey: 'iaDiagram.description', icon: 'lan' },
  inventory: { path: '/tasks/inventory', titleKey: 'inventory._nav', descriptionKey: 'inventory.description', icon: 'checklist_rtl' },
  metadata: { path: undefined, titleKey: 'metadata._nav', descriptionKey: 'metadata.description', icon: 'source' },
  exportPages: { path: '/tasks/export-pages', titleKey: 'exportPages._nav', descriptionKey: 'exportPages.description', icon: 'drive_folder_upload' },
  editPages: { path: '/tasks/edit-pages', titleKey: 'editPages._nav', descriptionKey: 'editPages.description', icon: 'auto_fix_high' },
  compare: { path: '/tasks/compare', titleKey: 'compare._nav', descriptionKey: 'compare.description', icon: 'library_books' },
  //Help
  help: { path: '/help', titleKey: 'help._nav', descriptionKey: 'help.description', icon: 'help_outline', hideInProd: true },
  contact: { path: '/contact', titleKey: 'contact._nav', descriptionKey: 'contact.description', icon: 'feedback', hideInProd: true },
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
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './doormats.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoormatsComponent {
  private readonly settingsService = inject(UserSettingsService);

  protected readonly prod = environment.production;
  protected readonly items: Record<DoormatKey, DoormatItem> = DOORMATS;

  public readonly keys = input.required<DoormatKey[]>();
  public readonly headingLevel = input<'h2' | 'h3' | 'h4' | 'h5'>('h3');
  public readonly style = input<'topic' | 'card'>('topic');

  protected iconClasses(notOutlined?: boolean) {
    const baseClasses = 'text-4xl p-2 border-1 border-round-lg surface-border';
    const materialClass = notOutlined ? 'material-icons' : 'material-icons-outlined';
    const bgClass = this.settingsService.darkMode() ? 'bg-primary-800 border-primery-700' : 'bg-primary-50 border-primary-100';
    return baseClasses + ' ' + materialClass + ' ' + bgClass;
  }

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
