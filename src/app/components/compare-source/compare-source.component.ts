import { Component, inject, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, computed, signal, effect } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

// PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { SplitButtonModule } from 'primeng/splitbutton';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

import { MessageModule } from 'primeng/message';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

// Services
import { CompareSourceService } from './compare-source.service';
import { htmlProcessingResult } from '../../services/html-normalization.service';

export enum SourceViewType {
    Original = 'original',
    Modified = 'modified',
    SideBySide = 'side-by-side',
    LineByLine = 'line-by-line'
}

export interface ViewOption<T = string> {
    label: string;
    value: T;
    icon: string;
}

@Component({
    selector: 'aida-compare-source',
    imports: [TranslateModule, CommonModule, FormsModule,
        ButtonModule, SplitButtonModule, RadioButtonModule, ToolbarModule, TooltipModule],
    templateUrl: './compare-source.component.html',
    styleUrl: './compare-source.component.css'
})
export class CompareSourceComponent {
    private compareSourceService = inject(CompareSourceService);

    @Input() beforeContent: htmlProcessingResult | undefined;
    @Input() afterContent: htmlProcessingResult | undefined;

    // Source view options
    sourceSelectedView = signal<SourceViewType>(SourceViewType.SideBySide);

    get sourceViewOptions(): ViewOption<SourceViewType>[] {
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

    onSourceViewChange(viewType: SourceViewType) {
        this.sourceSelectedView.set(viewType);
    }
}