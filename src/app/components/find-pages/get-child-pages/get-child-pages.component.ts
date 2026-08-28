import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';

import { ProjectStateService } from '../../../services/project-state.service';
import { AddUrlsService } from '../../add-urls/add-urls.service';
import { GetChildPagesService } from './get-child-pages.service';

@Component({
  selector: 'aida-get-child-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, CheckboxModule, IftaLabelModule, InputNumberModule, ProgressBarModule],
  templateUrl: './get-child-pages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetChildPagesComponent {
  // Services
  private projectState = inject(ProjectStateService);
  public getChildPagesService = inject(GetChildPagesService);
  private addUrlsService = inject(AddUrlsService);

  protected readonly childUrls = signal<{ url: string; selected: boolean }[]>([]);

  // Count selected child urls
  protected readonly selectedChildUrlsCount = computed(() => this.childUrls().filter((child) => child.selected).length);

  // Toggle selection
  protected toggleChildUrl(index: number, selected: boolean) {
    this.childUrls.update((urls) => {
      const updated = [...urls];
      updated[index] = { ...updated[index], selected };
      return updated;
    });
  }

  protected async findChildPages() {
    const depth = this.getChildPagesService.depth;
    if (depth < 1) return;

    const lang = this.projectState.detectPrimaryLanguage();

    // Get in-scope URLs
    const inScopeUrls = new Set(this.projectState.getAllPages(lang, 'live', 'inScope').map((u) => u.url));

    // Get child pages up to specified depth
    const childPages = await this.getChildPagesService.findChildren(inScopeUrls, depth);

    // Display results
    this.childUrls.set(childPages.map((url) => ({ url, selected: true })));
  }

  // Add to project
  protected addUrlsToProject() {
    const selectedUrls = this.childUrls()
      .filter((item) => item.selected)
      .map((item) => item.url);
    this.addUrlsService.appendUrlsToInput(selectedUrls);
    // Clear selection after adding
    this.childUrls.set([]);
  }
}
