import { CommonModule, LocationStrategy } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Input, OnChanges, signal, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { RadioButtonModule } from 'primeng/radiobutton';

import { htmlProcessingResult } from '../../../services/html-normalization.service';
import { CompareSourceService } from './compare-source.service';

export enum SourceViewType {
  Original = 'original',
  Modified = 'modified',
  SideBySide = 'side-by-side',
  LineByLine = 'line-by-line',
}

export interface ViewOption<T = string> {
  label: string;
  value: T;
  icon: string;
}

@Component({
  selector: 'aida-compare-source',
  imports: [CommonModule, FormsModule, TranslatePipe, RadioButtonModule],
  templateUrl: './compare-source.component.html',
  styleUrl: './compare-source.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareSourceComponent {
  private readonly compareSourceService = inject(CompareSourceService);

  @Input() beforeContent: htmlProcessingResult | undefined;
  @Input() afterContent: htmlProcessingResult | undefined;

  // Source view options
  protected readonly sourceSelectedView = signal<SourceViewType>(SourceViewType.SideBySide);

  protected get sourceViewOptions(): ViewOption<SourceViewType>[] {
    return [
      {
        label: `compare.pageOptions.${this.beforeContent?.version ?? 'before'}`,
        value: SourceViewType.Original,
        icon: 'pi pi-file',
      },
      {
        label: 'compare.view.sidebyside',
        value: SourceViewType.SideBySide,
        icon: 'pi pi-pause',
      },
      {
        label: 'compare.view.linebyline',
        value: SourceViewType.LineByLine,
        icon: 'pi pi-equals',
      },
      {
        label: `compare.pageOptions.${this.afterContent?.version ?? 'after'}`,
        value: SourceViewType.Modified,
        icon: 'pi pi-file-edit',
      },
    ];
  }

  protected onSourceViewChange(viewType: SourceViewType) {
    this.sourceSelectedView.set(viewType);
  }
}
