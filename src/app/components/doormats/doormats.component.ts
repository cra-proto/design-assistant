import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { MailtoService } from '../../services/mailto.service';
import { UserSettingsService } from '../../services/user-settings.service';

import { environment } from '../../../environments/environment';
import { AidaLinks } from '../../common/aidaLinks.config';

export interface DoormatItem {
  path?: string;
  titleKey: string;
  descriptionKey: string;
  icon?: string;
  notOutlined?: boolean;
  function?: any;
  isExternal?: boolean;
  hideInProd?: boolean;
}

// Complete doormat list (so we only have to maintain 1 source)
export const DOORMATS = {
  //Top level paths
  newProject: { path: AidaLinks.NewProject, titleKey: 'project._nav.new', descriptionKey: 'project.new.description', icon: 'add' },
  switchProject: { path: AidaLinks.AllProjects, titleKey: 'switch._title', descriptionKey: 'switch.description', icon: 'folder_open' },
  //Active project
  dashboard: { path: AidaLinks.ProjectDashboard, titleKey: 'dashboard._title', descriptionKey: 'dashboard.description', icon: 'view_quilt' },
  editProject: { path: AidaLinks.ProjectSettings, titleKey: 'project._nav.edit', descriptionKey: 'project.edit.description', icon: 'edit' },
  addPages: { path: AidaLinks.ProjectAdd, titleKey: 'addPages._nav', descriptionKey: 'addPages.description', icon: 'note_add' },
  search: { path: undefined, titleKey: 'search._nav', descriptionKey: 'search.description', icon: 'manage_search', hideInProd: true },
  problems: { path: undefined, titleKey: 'problems._nav', descriptionKey: 'problems.description', icon: 'troubleshoot', hideInProd: true },
  iaDiagram: { path: AidaLinks.ProjectDiagram, titleKey: 'iaDiagram._title', descriptionKey: 'iaDiagram.description', icon: 'lan' },
  inventory: { path: AidaLinks.ProjectInventory, titleKey: 'inventory._nav', descriptionKey: 'inventory.description', icon: 'checklist_rtl' },
  metadata: { path: undefined, titleKey: 'metadata._nav', descriptionKey: 'metadata.description', icon: 'source', hideInProd: true },
  exportPages: { path: AidaLinks.ProjectExport, titleKey: 'exportPages._nav', descriptionKey: 'exportPages.description', icon: 'drive_folder_upload' },
  editPages: { path: AidaLinks.ProjectEdit, titleKey: 'editPages._nav', descriptionKey: 'editPages.description', icon: 'auto_fix_high' },
  compare: { path: AidaLinks.ProjectCompare, titleKey: 'compare._nav', descriptionKey: 'compare.description', icon: 'library_books' },
  //Help
  help: { path: AidaLinks.Help, titleKey: 'help._title', descriptionKey: 'help.description', icon: 'help_outline', hideInProd: true },
  contact: { path: AidaLinks.Contact, titleKey: 'feedback._title', descriptionKey: 'feedback.description', icon: 'feedback', function: 'mailTo' },
  //Standalone
  standaloneCompare: { path: AidaLinks.StandaloneCompare, titleKey: 'compare._nav', descriptionKey: 'compare.description' },
  //Dev
  monitoring: { path: AidaLinks.DevMonitoring, titleKey: 'dev.monitoring._title', descriptionKey: 'dev.monitoring.description' },
  colors: { path: AidaLinks.DevColours, titleKey: 'dev.colors._title', descriptionKey: 'dev.colors.description' },
  patterns: { path: AidaLinks.DevPatterns, titleKey: 'dev.patterns._title', descriptionKey: 'dev.patterns.description' },
  prompts: { path: AidaLinks.DevPrompts, titleKey: 'dev.prompts._title', descriptionKey: 'dev.prompts.description' },
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
  private readonly mailtoService = inject(MailtoService);

  protected readonly prod = environment.production;
  protected readonly items: Record<DoormatKey, DoormatItem> = DOORMATS;

  public readonly keys = input.required<DoormatKey[]>();
  public readonly headingLevel = input<'h2' | 'h3' | 'h4' | 'h5'>('h3');
  public readonly style = input<'topic' | 'card'>('topic');

  protected iconClasses(notOutlined?: boolean) {
    const baseClasses = 'text-primary text-4xl p-2 border-1 border-round-lg surface-border';
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

  protected getOnClick(key: DoormatKey): ((event: Event) => void) | undefined {
    const overrides: Partial<Record<DoormatKey, (event: Event) => void>> = {
      contact: this.mailTo,
    };
    return overrides[key];
  }

  protected readonly mailTo = () => {
    console.log('Opening mailto!');
    this.mailtoService.openMailto(this.mailtoService.generateFeedbackMailto());
  };

  markForTranslation() {
    marker('metadata._nav');
    marker('metadata.description');
    marker('feedback._title');
    marker('feedback.description');
    marker('search._nav');
    marker('search.description');
    marker('problems._nav');
    marker('problems.description');
    marker('iaDiagram.description');
    marker('compare.description');
    marker('help.description');
    marker('ucdg.discover.description');
    marker('ucdg.discover.link');
    marker('ucdg.discover.title');
  }
}
