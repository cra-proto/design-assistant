import { ChangeDetectionStrategy, Component, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmationService, MenuItem, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { Menu, MenuModule } from 'primeng/menu';

import { EditNodeComponent } from '../edit-node/edit-node.component';

import { OpenRouterService } from '../../services/ai/openrouter.service';
import { FetchService } from '../../services/fetch.service';
import { ProjectStateService } from '../../services/project-state.service';
import { CompareService } from '../../views/tasks/compare/compare.service';

import { AidaLinks } from '../../common/aidaLinks.config';
import { TreeNodeData } from '../../common/data.model';
import { InventoryPrompts } from '../../common/prompts/inventory.prompts';
import { InventoryPromptKey } from '../../common/prompts/prompt.model';

export interface BooleanToggleItem extends MenuItem {
  type: 'booleanToggle';
  onYes: () => void;
  onNo: () => void;
}

@Component({
  selector: 'aida-menu-bulk-page-actions',
  imports: [TranslatePipe, ButtonModule, MenuModule, EditNodeComponent],
  templateUrl: './menu-bulk-page-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuBulkPageActionsComponent {
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly projectState = inject(ProjectStateService);
  private readonly fetchService = inject(FetchService);
  private readonly openRouterService = inject(OpenRouterService);
  private readonly compareService = inject(CompareService);

  /** Selected pages in TreeNode format. Calling component should do the conversion from flat data to TreeNode */
  public readonly selectedNodes = input.required<TreeNode<TreeNodeData>[]>();
  public readonly deleted = output<void>();

  /** Signal for node editor */
  protected readonly selectedNode = signal<TreeNode<TreeNodeData> | undefined>(undefined);
  protected editingNode = false;

  /** REFRESH: Refresh prototype or live data for all selected nodes */
  private async refreshData(version: 'live' | 'prototype') {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;

    const urlVersion = version === 'live' ? 'live' : this.projectState.getProject().repoType === 'github' ? 'protoGH' : 'protoUT';
    const paths = nodes.map((n) => (n.data as TreeNodeData).path.en);

    await this.projectState.withLoading(paths, version, async () => {
      for (const node of nodes) {
        await this.projectState.refreshNode(node, urlVersion);
      }
    });
  }

  /** METADATA: Generate metadata via AI for all selected pages */
  private async generateMetadata(mode: 'live' | 'prototype' = 'live') {
    const nodes = this.selectedNodes();
    if (!nodes.length) return;

    const project = this.projectState.getProject();
    const urlVersion = mode === 'live' ? 'live' : project.repoType === 'github' ? 'protoGH' : 'protoUT';
    const paths = nodes.map((node) => (node.data as TreeNodeData).path.en);

    await this.projectState.withLoading(paths, 'aiMetadata', async () => {
      for (const node of nodes) {
        if (!node.data?.path) continue;
        // Set URLs to fetch
        const enUrl = this.fetchService.generateUrl(node.data.path.en, urlVersion, project.github.owner, project.github.repo);
        const frUrl = this.fetchService.generateUrl(node.data.path.fr, urlVersion, project.github.owner, project.github.repo);
        if (!enUrl && !frUrl) {
          console.warn(`Skipping ${enUrl} — missing EN & FR URLs`);
          continue;
        }
        // Fetch main content
        let enMain: string | null = null;
        let frMain: string | null = null;
        try {
          if (enUrl) {
            const enDoc = urlVersion !== 'protoUT' ? await this.fetchService.fetchContent(enUrl, 'prod', 3, 'none', true) : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(enUrl));
            enMain = enDoc.querySelector('main')?.innerHTML ?? enDoc.body.innerHTML;
          }
          if (frUrl) {
            const frDoc = urlVersion !== 'protoUT' ? await this.fetchService.fetchContent(frUrl, 'prod', 3, 'none', true) : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(frUrl));
            frMain = frDoc.querySelector('main')?.innerHTML ?? frDoc.body.innerHTML;
          }
        } catch (error) {
          console.warn(`Skipping ${enUrl} — fetch failed`, error);
          continue;
        }

        // Build context for the AI
        const context = {
          en: {
            url: enUrl,
            existingDescription: node.data[mode]?.en.description,
            existingKeywords: node.data[mode]?.en.keywords,
            content: enMain,
          },
          fr: {
            url: frUrl,
            existingDescription: node.data[mode]?.en.description,
            existingKeywords: node.data[mode]?.en.keywords,
            content: frMain,
          },
        };

        // Call OpenRouter
        let response: string;
        try {
          response = await this.openRouterService.getTextFromAI(InventoryPrompts[InventoryPromptKey.Metadata], JSON.stringify(context));
        } catch (error) {
          console.warn(`Skipping ${enUrl} — AI call failed`, error);
          continue;
        }

        // Parse and merge into tree
        const path = this.projectState.detectPrimaryLanguage() === 'fr' ? node.data.path.fr : node.data.path.en;
        try {
          const parsed = JSON.parse(response);
          this.projectState.setMetadataReview(
            path,
            {
              generatedAt: new Date(),
              model: this.openRouterService.state().respondingModel ?? 'unknown',
              en: {
                description: { ai: parsed.en.description, status: 'pending' },
                keywords: { ai: parsed.en.keywords, status: 'pending' },
              },
              fr: {
                description: { ai: parsed.fr.description, status: 'pending' },
                keywords: { ai: parsed.fr.keywords, status: 'pending' },
              },
            },
            InventoryPrompts[InventoryPromptKey.Metadata],
          );
        } catch (error) {
          console.warn(`Skipping ${path} — could not parse AI response`, error);
          continue;
        }
      }
    });
  }

  /** EDIT: open selected page in "Edit pages" tool (only available if 1 page selected) */
  protected openInEditPages(node: TreeNode<TreeNodeData>) {
    const path = this.projectState.detectPrimaryLanguage() === 'fr' ? node.data?.path.fr : node.data?.path.en;
    if (path) {
      this.compareService.selectedPage.set(path);
      this.router.navigate([AidaLinks.ProjectEdit]);
    } else {
      console.error('There is no path associated with this page');
    }
  }

  /** EDIT: open selected page in node editor popup (only available if 1 page selected) */
  protected editNode(node: TreeNode<TreeNodeData>) {
    this.selectedNode.set(node);
    this.editingNode = true;
  }

  /** STATUS: set scope, unpublish, archive, or noindex status for all selected pages*/
  protected bulkSetBooleans(dataSection: string[], value: boolean): void {
    const sections = dataSection.includes('lang') ? (['en', 'fr'] as const).map((l) => dataSection.map((k) => (k === 'lang' ? l : k))) : [dataSection];

    let changed = false;

    for (const node of this.selectedNodes()) {
      if (!node.data) return;
      for (const section of sections) {
        if (this.projectState.getNestedValue(node.data, section) !== value) {
          this.projectState.setNestedValue(node.data, section, value);
          changed = true;
        }
      }
    }

    if (changed) {
      this.projectState.setModifiedDate();
    }
  }

  private readonly bulkEditableBooleans: { dataSection: string[]; labelKey: string; icon: string }[] = [
    { dataSection: ['status', 'inScope'], labelKey: 'inventory.header.inScope', icon: 'pi pi-check text-green' },
    //{ dataSection: ['status', 'isNew'], labelKey: 'inventory.header.isNew', icon: 'pi pi-plus text-blue-500' },
    //{ dataSection: ['status', 'isMoved'], labelKey: 'inventory.header.isMoved', icon: 'pi pi-arrow-right text-orange-500' },
    { dataSection: ['status', 'isROT'], labelKey: 'inventory.header.isROT', icon: 'pi pi-trash text-red' },
    { dataSection: ['prototype', 'lang', 'isArchived'], labelKey: 'inventory.header.archiveStatus', icon: 'pi pi-book text-orange-500' },
    { dataSection: ['prototype', 'lang', 'noindex'], labelKey: 'inventory.header.noindex', icon: 'pi pi-android text-orange-500' },
  ];

  protected readonly menu = viewChild<Menu>('menu');

  protected handleBoolToggle(action: () => void): void {
    action();
    this.menu()?.hide();
  }

  /** DELETE */
  private onDeleteSelected() {
    if (!this.selectedNodes().length) return;
    const additionalDeletions = this.projectState.checkNodeDeletionImpact(this.selectedNodes());
    if (additionalDeletions.length > 0) {
      this.showDeletionConfirmation(this.selectedNodes().length, additionalDeletions);
    } else {
      this.confirmationService.confirm({
        message: this.translate.instant('inventory.delete.confirmMessage', { count: this.selectedNodes().length }),
        header: this.translate.instant('inventory.delete._title'),
        icon: 'pi pi-exclamation-circle',
        acceptIcon: 'pi pi-trash',
        acceptLabel: this.translate.instant('common.delete'),
        rejectLabel: this.translate.instant('common.cancel'),
        acceptButtonStyleClass: 'p-button-danger',
        rejectButtonStyleClass: 'p-button-secondary',
        accept: () => {
          this.projectState.deleteNodes(this.selectedNodes());
          this.deleted.emit(); // Emit event so parent can clear selection after delete
        },
      });
    }
  }

  private showDeletionConfirmation(deleteCount: number, additionalPages: { url: string; h1: string; inScope: boolean }[]) {
    const inScopeCount = additionalPages.filter((p) => p.inScope).length;
    const inScopeList = additionalPages
      .filter((p) => p.inScope)
      .map((p) => `${p.h1}`)
      .join('<br>');
    const baselineCount = additionalPages.filter((p) => !p.inScope).length;
    const baselineList = additionalPages
      .filter((p) => !p.inScope)
      .map((p) => `${p.h1}`)
      .join('<br>');
    const childWarning = this.translate.instant('inventory.delete.childPagesWarning', {
      deleteCount,
      childCount: additionalPages.length,
    });

    let message = `<p class="mt-0">${childWarning}</p>`;

    if (inScopeCount > 0) {
      const inScopeWarning = this.translate.instant('inventory.delete.inScopeWarning', { count: inScopeCount });
      const inScopeHeading = this.translate.instant('inventory.delete.inScopeHeading');
      message += `
            <p>${inScopeWarning}</p>
            <h2>${inScopeHeading}</h2>
            <p>${inScopeList}</p>
        `;
    }

    if (baselineCount > 0) {
      const baselineHeading = this.translate.instant('inventory.delete.baselineHeading');
      message += `
            <h2>${baselineHeading}</h2>
            <p>${baselineList}</p>
        `;
    }

    message = message.trim();

    this.confirmationService.confirm({
      key: 'inventory',
      message,
      header: this.translate.instant('inventory.delete._title'),
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'pi pi-trash',
      acceptLabel: this.translate.instant('common.delete'),
      rejectLabel: this.translate.instant('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      rejectButtonStyleClass: 'p-button-secondary',
      accept: () => {
        this.projectState.deleteNodes(this.selectedNodes());
        this.deleted.emit(); // Emit event so parent can clear selection after delete
      },
    });
  }

  /** Dynamically built dropdown menu items*/
  protected itemsDropdown: MenuItem[] = [];

  // 1. Dropdown menus (p-menu)
  protected updateDropdown() {
    const numPages = this.selectedNodes().length;
    const numChildPages = this.projectState.checkNodeDeletionImpact(this.selectedNodes()).length;
    const refreshingProto = this.projectState.isAnyLoading('prototype');
    const refreshingLive = this.projectState.isAnyLoading('live');

    //Only add edit group if a single page is selected
    const editGroup: MenuItem[] =
      numPages === 1
        ? [
            {
              label: this.translate.instant('common.edit'),
              styleClass: 'text-primary-500',
              items: [
                {
                  label: this.translate.instant('editPages._title'),
                  icon: 'pi pi-sparkles',
                  command: () => this.openInEditPages(this.selectedNodes()[0]),
                },
                {
                  label: this.translate.instant('common.editNode'),
                  icon: 'pi pi-pen-to-square',
                  command: () => this.editNode(this.selectedNodes()[0]),
                },
              ],
            },
          ]
        : [];

    this.itemsDropdown = [
      {
        label: this.translate.instant('common.refresh'),
        styleClass: 'text-primary-500',
        items: [
          {
            label: refreshingProto
              ? this.translate.instant('inventory.menu.refreshing.prototype', { pageCount: numPages })
              : this.translate.instant('inventory.menu.refresh.prototype', { pageCount: numPages }),
            icon: refreshingProto ? 'pi pi-spin pi-spinner' : 'pi pi-refresh',
            disabled: numPages === 0,
            command: () => {
              this.refreshData('prototype');
            },
          },
          {
            label: refreshingLive ? this.translate.instant('inventory.menu.refreshing.live', { pageCount: numPages }) : this.translate.instant('inventory.menu.refresh.live', { pageCount: numPages }),
            icon: refreshingLive ? 'pi pi-spin pi-spinner' : 'pi pi-refresh',
            disabled: numPages === 0,
            command: () => {
              this.refreshData('live');
            },
          },
        ],
      },
      {
        label: this.translate.instant('inventory.menu.metadata'),
        styleClass: 'text-primary-500',
        items: [
          {
            label: this.openRouterService.state().loading
              ? this.translate.instant('inventory.menu.metadata.generating', { pageCount: numPages })
              : this.translate.instant('inventory.menu.metadata.generate', { pageCount: numPages }),
            icon: this.openRouterService.state().loading ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles',
            disabled: numPages === 0 || this.openRouterService.state().loading,
            command: async () => {
              await this.generateMetadata();
            },
          },
        ],
      },
      {
        label: this.translate.instant('inventory.menu.updateStatus'),
        styleClass: 'text-primary-500',
        items: this.bulkEditableBooleans.map(
          (boolean) =>
            ({
              type: 'booleanToggle',
              label: this.translate.instant(boolean.labelKey),
              icon: boolean.icon,
              disabled: numPages === 0,
              onYes: () => this.bulkSetBooleans(boolean.dataSection, true),
              onNo: () => this.bulkSetBooleans(boolean.dataSection, false),
            }) as BooleanToggleItem,
        ),
      },
      ...editGroup,
      {
        label: this.translate.instant('inventory.menu.delete'),
        styleClass: 'text-red',
        items: [
          {
            label: this.translate.instant('inventory.menu.delete.selected', { pageCount: numPages, childCount: numChildPages }),
            icon: 'pi pi-trash text-red',
            disabled: numPages === 0,
            command: () => {
              this.onDeleteSelected();
            },
          },
        ],
      },
    ];
    return;
  }
}
