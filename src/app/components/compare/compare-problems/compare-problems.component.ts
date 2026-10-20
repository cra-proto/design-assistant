import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, TemplateRef, viewChild } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { AccordionModule } from 'primeng/accordion';

import { DesignComponentsComponent } from './design-components/design-components.component';

import { htmlProcessingResult } from '../../../services/html-normalization.service';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'aida-compare-problems',
  imports: [CommonModule, AccordionModule, DesignComponentsComponent],
  templateUrl: './compare-problems.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareProblemsComponent {
  private readonly translate = inject(TranslateService);
  protected readonly production = environment.production;

  // Inputs
  public readonly beforeContent = input<htmlProcessingResult | undefined>();
  public readonly afterContent = input<htmlProcessingResult | undefined>();

  // Template references
  protected readonly dataTemplate = viewChild.required<TemplateRef<unknown>>('data');
  protected readonly componentsTemplate = viewChild.required<TemplateRef<unknown>>('components');
  protected readonly linksTemplate = viewChild.required<TemplateRef<unknown>>('links');

  // Accordion content
  protected get tools(): { key: string; header: string; description: string; template: TemplateRef<unknown>; icon: string; visible: boolean }[] {
    return [
      {
        key: 'data',
        header: this.translate.instant('problems.data.header'),
        description: this.translate.instant('problems.data.description'),
        template: this.dataTemplate(),
        icon: 'analytics',
        visible: false,
      },
      {
        key: 'components',
        header: this.translate.instant('problems.components.header'),
        description: this.translate.instant('problems.components.description'),
        template: this.componentsTemplate(),
        icon: 'draw',
        visible: true,
      },
      {
        key: 'links',
        header: this.translate.instant('problems.links.header'),
        description: this.translate.instant('problems.links.description'),
        template: this.linksTemplate(),
        icon: 'link',
        visible: false,
      },
    ];
  }

  // Track & toggle open accordion panels
  activePanels: string[] = [];
  isPanelOpen(panelKey: string): boolean {
    return this.activePanels.includes(panelKey);
  }
  openPanel(panelKey: string): void {
    if (this.isPanelOpen(panelKey)) return;
    this.activePanels = [...this.activePanels, panelKey];
  }
}
