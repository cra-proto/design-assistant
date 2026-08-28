import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TooltipModule } from 'primeng/tooltip';

import { EditNodeComponent } from '../../edit-node/edit-node.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { AddUrlsService } from '../add-urls.service';

@Component({
  selector: 'aida-invalid-urls',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    BadgeModule,
    ButtonModule,
    CheckboxModule,
    DialogModule,
    IftaLabelModule,
    MessageModule,
    SelectModule,
    TabsModule,
    TooltipModule,
    EditNodeComponent,
  ],
  templateUrl: './invalid-urls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvalidUrlsComponent {
  private readonly addUrlsService = inject(AddUrlsService);
  private readonly projectState = inject(ProjectStateService);
  private readonly translate = inject(TranslateService);
  private readonly fetchService = inject(FetchService);

  protected readonly urlsBroken = computed(() => this.addUrlsService.urlState().urlsToReview.filter((url) => url.status === 'bad'));
  protected readonly urlsRedirect = computed(() => this.addUrlsService.urlState().urlsToReview.filter((url) => url.status === 'redirect'));
  protected readonly urlsBlocked = computed(() => this.addUrlsService.urlState().urlsToReview.filter((url) => url.status === 'blocked'));

  protected readonly urlsNew = computed(() => this.addUrlsService.urlState().urlsToReview.filter((url) => url.status === 'new'));

  protected readonly tabs = computed(() =>
    [
      { value: '0', status: 'broken', label: 'invalidUrls.broken.header', items: this.urlsBroken() },
      { value: '1', status: 'redirect', label: 'invalidUrls.redirect.header', items: this.urlsRedirect() },
      { value: '2', status: 'blocked', label: 'invalidUrls.blocked.header', items: this.urlsBlocked() },
    ].filter((tab) => (tab.status === 'broken' ? tab.items.length > 0 || this.urlsNew().length > 0 : tab.items.length > 0)),
  );

  protected readonly initialTab = computed(() => this.tabs()[0]?.value ?? '0');

  //Template references
  protected readonly brokenTemplate = viewChild.required<TemplateRef<unknown>>('broken');
  protected readonly redirectTemplate = viewChild.required<TemplateRef<unknown>>('redirect');
  protected readonly blockedTemplate = viewChild.required<TemplateRef<unknown>>('blocked');

  protected get outlets(): Record<string, TemplateRef<unknown>> {
    return {
      broken: this.brokenTemplate(),
      redirect: this.redirectTemplate(),
      blocked: this.blockedTemplate(),
    };
  }

  protected readonly selectedBrokenUrls = signal<string[]>([]);
  protected isSelected(href: string): boolean {
    return this.selectedBrokenUrls().includes(href);
  }
  protected toggleBrokenUrl(href: string, selected: boolean) {
    this.selectedBrokenUrls.update((current) => (selected ? [...current, href] : current.filter((h) => h !== href)));
  }

  protected readonly parentPages = computed(() => this.projectState.getAllPages(this.projectState.detectPrimaryLanguage(), 'live', 'all'));
  protected selectedParent?: string;

  protected addUrlsToProject() {
    console.log('ADDING!');
    console.log('Selected URLs: ', this.selectedBrokenUrls());
    console.log('Selected Parent: ', this.selectedParent);
    if (!this.selectedParent) return;
    const parentNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), this.selectedParent, this.projectState.detectPrimaryLanguage());
    console.log('Parent: ', parentNode);
    if (!parentNode) return;
    for (const url of this.selectedBrokenUrls()) {
      console.log('URL: ', url);
      this.projectState.createNode(parentNode, url);
    }
    this.addUrlsService.updateReviewStatus(this.selectedBrokenUrls(), 'new');
    this.selectedBrokenUrls.set([]);
    const newestUrl = this.urlsNew().at(-1)?.href;
    if (newestUrl) this.edit(newestUrl);
  }

  protected get currentLang() {
    return this.translate.currentLang() === 'fr' ? 'fr' : 'en';
  }
  protected editNode = false; // Tracks if currently making dialog edits
  protected selectedNode: TreeNode = {}; // TreeNode data for edit node dialog
  protected edit(url: string) {
    const path = this.fetchService.generatePath(url);
    const lang = this.fetchService.getLang(url) ?? 'en';
    this.selectedNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, lang) ?? {};
    this.editNode = true;
  }

  protected async copyToClipboard(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }
}
