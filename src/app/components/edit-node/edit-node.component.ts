import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FieldsetModule } from 'primeng/fieldset';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { ProjectStateService } from '../../services/project-state.service';

import { SourceVersion, TreeNodeData } from '../../common/data.model';

@Component({
  selector: 'aida-edit-node',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    FieldsetModule,
    IftaLabelModule,
    InputGroupAddonModule,
    InputGroupModule,
    InputTextModule,
    MessageModule,
    SelectButtonModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './edit-node.component.html',
  styleUrl: './edit-node.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditNodeComponent {
  protected readonly projectState = inject(ProjectStateService);
  private readonly translate = inject(TranslateService);

  public readonly node = input.required<TreeNode>();
  public readonly isOpen = input<boolean>(false);
  public readonly initialShowNotes = input<boolean>(false);
  dialogClose = output<void>();

  private readonly originalData = signal<TreeNodeData | null>(null);
  protected readonly selectedLanguage = signal<'en' | 'fr' | 'both'>(this.projectState.detectPrimaryLanguage());
  protected readonly selectedVersion = signal<'prototype' | 'live' | 'baseline'>('prototype');
  protected readonly pathEN = signal<string>('');
  protected readonly pathFR = signal<string>('');
  private readonly autoPath = signal<{ en: boolean; fr: boolean }>({ en: false, fr: false });
  protected readonly hasChanges = signal<boolean>(false);
  protected readonly moveError = signal<boolean>(false);
  protected readonly pathError = signal<boolean>(false);
  protected readonly editsEnabled = signal<boolean>(false);
  protected readonly urlEditsEnabled = signal<boolean>(false);
  protected readonly toggleNotes = signal<boolean>(this.initialShowNotes());

  private readonly DEFAULT_H1 = { en: 'New page', fr: 'Nouvelle page' };

  protected markChanges() {
    this.hasChanges.set(true);
  }

  constructor() {
    effect(() => {
      const node = this.node();
      const open = this.isOpen();
      const isAuto = (lang: 'en' | 'fr') => {
        const fragment = node.data.path[lang].split('/').pop()?.replace('.html', '') ?? '';
        const isPlaceholder = lang === 'en' ? fragment.startsWith('new-page-') : fragment.startsWith('nouvelle-page-');
        return isPlaceholder || this.projectState.sanitizeUrlFragment(node.data.prototype[lang].h1 ?? '') === fragment;
      };
      if (open && node?.data) {
        this.originalData.set(structuredClone(node.data));
        this.selectedVersion.set('prototype');
        this.pathEN.set(node.data.path.en.split('/').pop());
        this.pathFR.set(node.data.path.fr.split('/').pop());
        this.autoPath.set({ en: isAuto('en'), fr: isAuto('fr') });
        this.hasChanges.set(false);
        this.moveError.set(false);
        this.pathError.set(false);
        this.editsEnabled.set(false);
        this.urlEditsEnabled.set(false);
        this.toggleNotes.set(this.initialShowNotes());
      }
    });
  }

  protected save() {
    this.projectState.setModifiedDate();
    this.hasChanges.set(false);
    this.toggleNotes.set(false);
    this.originalData.set(structuredClone(this.node().data));
    this.dialogClose.emit();
  }
  protected cancel() {
    Object.assign(this.node().data, structuredClone(this.originalData()));
    this.hasChanges.set(false);
    this.toggleNotes.set(false);
    this.dialogClose.emit();
  }
  protected enableEdits(): void {
    this.editsEnabled.set(true);
  }
  protected enableUrlEdits(): void {
    this.urlEditsEnabled.set(true);
  }
  protected async refresh() {
    const version = this.selectedVersion();
    const repoType = this.projectState.getProject().repoType === 'github' ? 'GH' : 'UT';
    const urlVersion: SourceVersion = version === 'live' ? 'live' : version === 'prototype' ? `proto${repoType}` : `base${repoType}`;
    this.projectState.refreshing.update((r) => ({ ...r, [version]: true }));
    await this.projectState.refreshNode(this.node(), urlVersion);
    this.projectState.refreshing.update((r) => ({ ...r, [version]: false }));
    this.hasChanges.set(true);
  }
  protected syncData(node: TreeNode, field: 'template' | 'owner' | 'email' | 'isArchived' | 'noindex', direction: 'ENtoFR' | 'FRtoEN') {
    if (direction === 'ENtoFR') {
      node.data[this.selectedVersion()].fr[field] = node.data[this.selectedVersion()].en[field];
    }
    if (direction === 'FRtoEN') {
      node.data[this.selectedVersion()].en[field] = node.data[this.selectedVersion()].fr[field];
    }
  }

  /** Try to set full path, returns false and sets pathError if path is a duplicate */
  private trySetPath(newPath: string, lang: 'en' | 'fr'): boolean {
    const existingNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), newPath, lang);
    if (existingNode && existingNode !== this.node()) {
      this.pathError.set(true);
      return false;
    }
    this.pathError.set(false);
    this.node().data.path[lang] = newPath;
    this.markChanges();
    return true;
  }

  /** Update full path from final segment input */
  protected updatePath(lang: 'en' | 'fr'): boolean {
    const suffix = (lang === 'fr' ? this.pathFR() : this.pathEN()).replace('.html', '');
    const prefix = this.node().parent?.data.path[lang].replaceAll('.html', '') ?? this.node().data.path[lang].split('/').slice(0, -1).join('/');
    return this.trySetPath(`${prefix}/${suffix}.html`, lang);
  }

  /** Update full path from full path input */
  protected onPathInput(value: string, lang: 'en' | 'fr') {
    this.trySetPath(this.projectState.sanitizeUrlPath(value), lang);
  }

  /** Update final segment from final segment input then sync to full path */
  protected onFragmentInput(value: string, lang: 'en' | 'fr') {
    const sanitized = this.projectState.sanitizeUrlFragment(value);
    (lang === 'fr' ? this.pathFR : this.pathEN).set(sanitized);
    this.autoPath.update((a) => ({ ...a, [lang]: false }));
    this.updatePath(lang);
  }

  /** Sync final segment signal after full path changes (on blur) */
  protected updateFragment(lang: 'en' | 'fr') {
    if (!this.node().data.status.isNew) return;
    (lang === 'fr' ? this.pathFR : this.pathEN).set(this.node().data.path[lang].split('/').pop());
  }

  /** Sync name to all versions and to url for new pages until they go live */
  protected syncNewName(node: TreeNode, version: 'prototype' | 'live' | 'baseline', lang: 'en' | 'fr') {
    if (version !== 'prototype' || !node.data.live[lang].is404) return;

    //Update name
    const h1 = node.data.prototype[lang].h1;
    node.data.baseline[lang].h1 = h1;
    node.data.live[lang].h1 = h1;

    //Skip updating url fragment if user has overridden default fragment
    if (!this.autoPath()[lang]) return;
    //Skip updating url fragment if H1 is still default
    if (h1?.trim() === this.DEFAULT_H1[lang]) return;
    //Skip updating url fragment if none generated
    const newFragment = this.projectState.sanitizeUrlFragment(h1);
    if (!newFragment) return;

    //Update url fragment and path
    (lang === 'fr' ? this.pathFR : this.pathEN).set(newFragment);
    const isUpdated = this.updatePath(lang);

    //Restore original url fragment if update fails
    if (!isUpdated) {
      (lang === 'fr' ? this.pathFR : this.pathEN).set(this.node().data.path[lang].split('/').pop()?.replace('.html', '') ?? '');
    }
  }

  protected moveNode(node: TreeNode, newParentUrl: string, lang: 'en' | 'fr', version: 'prototype' | 'live' | 'baseline') {
    this.moveError.set(false);
    //Find new parent node
    if (version === 'prototype') {
      const tree = this.projectState.getProjectTree();
      const newParent = this.projectState.findNodeByPath(tree, newParentUrl, lang);
      if (!newParent) return;
      const result = this.projectState.moveNode(node, newParent);
      if (result === 'circular') {
        this.moveError.set(true);
        return;
      }
    } else {
      if (node.data[version][lang].parentPath !== newParentUrl) {
        node.data[version][lang].parentPath = newParentUrl;
        this.projectState.setModifiedDate();
        if (version === 'baseline') {
          // Update move status if baseline was corrected
          const enMoved = node.data.prototype.en.parentPath !== node.data.baseline.en.parentPath;
          const frMoved = node.data.prototype.fr.parentPath !== node.data.baseline.fr.parentPath;
          node.data.status.isMoved = enMoved || frMoved;
        }
      }
    }
    this.markChanges();
  }

  //Language options
  protected get languageOptions() {
    return [
      { label: this.translate.instant('common.language.english'), value: 'en' },
      { label: this.translate.instant('common.language.french'), value: 'fr' },
      { label: this.translate.instant('common.both'), value: 'both' },
    ];
  }

  //Version options
  protected get versionOptions() {
    return [
      { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
      { label: this.translate.instant('common.version.live'), value: 'live' },
      { label: this.translate.instant('common.version.baseline'), value: 'baseline' },
    ];
  }

  //Version-specific warning messages
  protected readonly versionConfig = computed(() => {
    switch (this.selectedVersion()) {
      case 'baseline':
        return { severity: 'error', icon: 'pi pi-times-circle font-bold', text: this.translate.instant('editNode.baselineWarning') } as const;
      case 'live':
        return { severity: 'warn', icon: 'pi pi-exclamation-triangle font-bold', text: this.translate.instant('editNode.liveWarning') } as const;
      default:
        return null;
    }
  });

  //Reset editsEnabled whenever selectedVersion changes
  protected readonly versionWatcher = effect(() => {
    this.selectedVersion();
    this.editsEnabled.set(false);
    this.urlEditsEnabled.set(false);
  });

  //Days since refresh
  protected readonly daysSinceRefresh = computed(() => {
    const data = this.node().data?.[this.selectedVersion()];
    if (!data) return null;

    const getDays = (lastChecked: string) => {
      if (!lastChecked) return null;
      const diff = Date.now() - new Date(lastChecked).getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    const lang = this.selectedLanguage();
    if (lang === 'en') return getDays(data.en.lastChecked);
    if (lang === 'fr') return getDays(data.fr.lastChecked);

    // Both selected — return the larger number
    const enDays = getDays(data.en.lastChecked);
    const frDays = getDays(data.fr.lastChecked);
    if (enDays === null && frDays === null) return null;
    return Math.max(enDays ?? 0, frDays ?? 0);
  });

  //Notes
  protected editNotes() {
    const node = this.node();
    if (!node.data?.notes) {
      node.data.notes = { issue: '', solution: '' };
    } else if (!node?.data?.notes?.issue) {
      node.data.notes.issue = '';
    } else if (!node?.data?.notes?.solution) {
      node.data.notes.solution = '';
    }
    this.toggleNotes.set(!this.toggleNotes());
  }

  protected get noteConfig(): { label: string; icon: string } {
    const node = this.node();
    const hasNotes = (node.data?.notes?.issue?.length ?? 0) + (node.data?.notes?.solution?.length ?? 0) > 0;

    if (this.toggleNotes()) {
      return { label: this.translate.instant('editNode.notes.save'), icon: 'pi pi-save' };
    }
    return hasNotes ? { label: this.translate.instant('editNode.notes.edit'), icon: 'pi pi-file-edit' } : { label: this.translate.instant('editNode.notes.add'), icon: 'pi pi-file-plus' };
  }

  //Parent page dropdown
  protected readonly enPages = computed(() => this.projectState.getAllPages('en', 'live', 'all'));

  protected readonly frPages = computed(() => this.projectState.getAllPages('fr', 'live', 'all'));
}
