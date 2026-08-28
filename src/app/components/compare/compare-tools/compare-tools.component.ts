// Update all page dropdowns with thier valid versions (speeds up page switching)
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Params, Router } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { UserSettingsComponent } from '../../user-settings/user-settings.component';
import { CompareAiOptionsComponent } from '../compare-ai-options/compare-ai-options.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareAiService } from '../compare-ai.service';
import { CompareService } from '../compare.service';

@Component({
  selector: 'aida-compare-tools',
  imports: [CommonModule, TranslatePipe, ButtonModule, DrawerModule, MenuModule, ToastModule, CompareAiOptionsComponent, UserSettingsComponent],
  templateUrl: './compare-tools.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareToolsComponent {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  protected readonly messageService = inject(MessageService);
  private readonly projectState = inject(ProjectStateService);
  protected readonly compareService = inject(CompareService);
  protected readonly compareAiService = inject(CompareAiService);
  private readonly fetchService = inject(FetchService);

  readabilityBefore = 0;
  readabilityAfter = 0;
  readabilityChange = 0;

  constructor() {
    effect(() => {
      const originalHTML = this.compareService.originalHtml()?.html ?? '';
      const modifiedHTML = this.compareService.modifiedHtml()?.html ?? '';
      const originalRead = this.fetchService.getReadability(this.fetchService.stringToDoc(originalHTML));
      const modifiedRead = this.fetchService.getReadability(this.fetchService.stringToDoc(modifiedHTML));
      this.readabilityBefore = Math.max(0, Math.min(originalRead.fleschKincaid, originalRead.gunningFog));
      this.readabilityAfter = Math.max(0, Math.min(modifiedRead.fleschKincaid, modifiedRead.gunningFog));
      this.readabilityChange = this.readabilityAfter - this.readabilityBefore;
    });
  }

  /** Dropdown options */
  protected get items(): MenuItem[] {
    const dropdownOptions = [
      {
        label: this.translate.instant('compare.tools.ai'),
        items: [
          {
            label: this.translate.instant('compare.aiOptions.send'),
            icon: 'pi pi-sparkles',
            command: () => {
              this.compareAiService.sendToAI();
            },
          },
          {
            label: this.translate.instant('compare.aiOptions._title'),
            icon: 'pi pi-bars',
            command: () => {
              this.compareService.aiDrawerVisible.update((v) => !v);
            },
          },
        ],
      },
      {
        label: this.translate.instant('compare.tools.other'),
        items: [
          {
            label: this.translate.instant('common.share'),
            icon: 'pi pi-share-alt',
            command: () => {
              this.shareLink();
            },
          },
        ],
      },
      {
        label: this.translate.instant('compare.tools.cache'),
        Tooltip: this.translate.instant('compare.tools.cache.tooltip'),
        items: [
          {
            label: !this.compareService.loadingAll() ? this.translate.instant('compare.tools.cache.loadAll') : this.translate.instant('compare.tools.cache.cancelLoadAll'),
            icon: !this.compareService.loadingAll() ? 'pi pi-download' : 'pi pi-spin pi-spinner',
            command: async () => {
              await this.toggleLoadAll();
            },
          },
          {
            label: this.translate.instant('compare.tools.cache.reset'),
            icon: 'pi pi-trash text-red-500',
            disabled: !this.compareService.loadingAll(),
            command: () => {
              this.compareService.clearCache();
            },
          },
        ],
      },
    ];
    return dropdownOptions;
  }

  /** Copies share link to clipboard */
  shareLink() {
    const beforeUrl = this.compareService.originalHtml()?.url;
    const afterUrl = this.compareService.modifiedHtml()?.url;
    if (!beforeUrl || !afterUrl) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('common.copyError'),
        detail: this.translate.instant('compare.tools.noShareURL'),
        life: 5000,
      });
      return;
    }
    const params: Params = { before: beforeUrl, after: afterUrl };
    const treeLink = this.router.createUrlTree(['/standalone/compare-versions'], { queryParams: params });
    const shareLink = `${window.location.origin}${this.router.serializeUrl(treeLink)}`;

    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.copiedToClipboard'),
          detail: `${shareLink}`,
          life: 2000,
        });
      })
      .catch((err) => console.error('Clipboard copy failed:', err));
  }

  /** Runs either {@link cancelSetCache} or {@link setCacheForAll} */
  private async toggleLoadAll() {
    if (!this.compareService.loadingAll()) {
      await this.setCacheForAll();
    } else {
      this.cancelSetCache();
      console.log('toggle cancel');
    }
  }

  private cacheAbortController: AbortController | null = null;
  /** Cancels {@link setCacheForAll} */
  cancelSetCache() {
    this.cacheAbortController?.abort();
  }

  /** Sets status for all project pages in cache for faster navigation between pages */
  async setCacheForAll() {
    this.cacheAbortController = new AbortController();
    const signal = this.cacheAbortController.signal;
    this.compareService.loadingAll.set(true);
    try {
      // Get all project paths
      const lang = this.projectState.detectPrimaryLanguage();
      const allPaths = new Set(this.projectState.getAllPages(lang, 'live', 'inScope').map((p) => p.path));
      // Check all versions
      for (const path of allPaths) {
        if (signal.aborted) break;
        const versionsToCheck = this.compareService.getVersionsToCheck(path);
        const validVersions = ['ai'];
        for (const { url, version } of versionsToCheck) {
          await this.compareService.checkVersion(url, version, validVersions);
        }
      }
    } finally {
      this.compareService.loadingAll.set(false);
    }
  }

  protected toggleAiDrawer(): void {
    this.compareService.aiDrawerVisible.update((v) => !v);
  }
}
