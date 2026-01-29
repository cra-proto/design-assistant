import { Component, effect, OnDestroy, AfterViewInit, ViewChildren, QueryList, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TabViewModule } from 'primeng/tabview';

import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';

import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { IftaLabelModule } from 'primeng/iftalabel';

import { ThemeService } from '../../../services/theme.service';
import { TooltipModule } from "primeng/tooltip";

interface CodeExample {
    label: string;
    code: string;
    description?: string;
}

@Component({
    selector: 'aida-design-patterns',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule,
        TabViewModule, MessageModule, ButtonModule, TooltipModule,
        InputTextModule, TextareaModule, SelectModule, IftaLabelModule,
    ],
    templateUrl: './design-patterns.component.html',
    styleUrl: './design-patterns.component.css'
})
export class DesignPatternsComponent implements AfterViewInit, OnDestroy {
    public themeService = inject(ThemeService);

    @ViewChildren('codeContainer') codeContainers!: QueryList<ElementRef>;

    private darkModeEffect;
    private prismLoaded = false;
    public copiedIndex = signal<string | null>(null);

    public messageExamples: CodeExample[] = [
        {
            label: 'Info',
            code: `<p-message severity="info" icon="pi pi-info-circle font-bold" [text]="'example.message.info' | translate" />`,
            description: 'example.pattern.message.info.desc'
        },
        {
            label: 'Success',
            code: `<p-message severity="success" icon="pi pi-check-circle font-bold" [text]="'example.message.success' | translate" />`,
            description: 'example.pattern.message.success.desc'
        },
        {
            label: 'Warning',
            code: `<p-message severity="warn" icon="pi pi-exclamation-triangle font-bold" [text]="'example.message.warn' | translate" />`,
            description: 'example.pattern.message.warn.desc'
        },
        {
            label: 'Error',
            code: `<p-message severity="error" icon="pi pi-times-circle font-bold" [text]="'example.message.error' | translate" />`,
            description: 'example.pattern.message.error.desc'
        }
    ];

    public buttonExamples: CodeExample[] = [
        {
            label: 'Primary & Secondary Outline',
            code: `<div class="flex gap-2">
    <p-button [label]="'example.button.save' | translate" icon="pi pi-check" />
    <p-button [label]="'example.button.cancel' | translate" icon="pi pi-times" severity="secondary" outlined />
</div>`,
            description: 'example.pattern.button.primary.desc'
        },
        {
            label: 'Danger & Secondary Outline',
            code: `<div class="flex gap-2">
    <p-button [label]="'example.button.delete' | translate" icon="pi pi-trash" severity="danger" />
    <p-button [label]="'example.button.cancel' | translate" icon="pi pi-times" severity="secondary" outlined />
</div>`,
            description: 'example.pattern.button.danger.desc'
        },
        {
            label: 'Secondary Task Button',
            code: `<p-button [label]="'example.button.task' | translate" icon="pi pi-cog" outlined styleClass="secondary-outline" />`,
            description: 'example.pattern.button.task.desc'
        },
        {
            label: 'Icon Buttons',
            code: `<div class="flex gap-2">
    <p-button icon="pi pi-trash" severity="danger" text rounded [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
    <p-button icon="pi pi-share-alt" severity="primary" text rounded [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
    <p-button icon="pi pi-sync" severity="primary" [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
</div>`,
            description: 'example.pattern.button.icon.desc'
        }
    ];

    public cardExamples: CodeExample[] = [
        {
            label: 'Standard Card Container',
            code: `<div class="surface-card border-round p-4 shadow-2">
    <!-- Content here -->
</div>`,
            description: 'example.pattern.card.standard.desc'
        },
        {
            label: 'Section Card with Border',
            code: `<div class="surface-section border-1 surface-border border-round p-4">
    <!-- Content here -->
</div>`,
            description: 'example.pattern.card.section.desc'
        }
    ];

    public inputExamples: CodeExample[] = [
        {
            label: 'Input Text with IFTA Label',
            code: `<p-iftaLabel>
    <input pInputText id="example-input" [(ngModel)]="value" fluid />
    <label for="example-input">{{ 'example.input.label' | translate }}</label>
</p-iftaLabel>`,
            description: 'example.pattern.input.text.desc'
        },
        {
            label: 'Textarea with IFTA Label',
            code: `<p-iftaLabel>
    <textarea pInputTextarea id="example-textarea" [(ngModel)]="value" rows="3" fluid></textarea>
    <label for="example-textarea">{{ 'example.input.textarea.label' | translate }}</label>
</p-iftaLabel>`,
            description: 'example.pattern.input.textarea.desc'
        },
        {
            label: 'Select with IFTA Label',
            code: `<p-iftaLabel>
    <p-select 
        inputId="example-select" 
        [options]="options" [(ngModel)]="selectedOption" 
        optionLabel="label" optionValue="value"
        fluid
    />
    <label for="example-select">{{ 'example.input.select.label' | translate }}</label>
</p-iftaLabel>`,
            description: 'example.pattern.input.select.desc'
        }
    ];

    public exampleValue = '';
    public exampleTextarea = '';
    public exampleOptions = [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
        { label: 'Option 3', value: 'option3' }
    ];
    public selectedOption = '';

    constructor() {
        // Watch for dark mode changes to update Prism theme
        this.darkModeEffect = effect(() => {
            const isDarkMode = this.themeService.darkMode();
            if (this.prismLoaded) {
                this.loadPrismTheme(isDarkMode);
            }
        });
    }

    async ngAfterViewInit(): Promise<void> {
        await this.highlightAllCode();

        // Re-highlight when code containers change (e.g., tab switching)
        this.codeContainers.changes.subscribe(() => {
            this.highlightAllCode();
        });
    }

    ngOnDestroy(): void {
        this.darkModeEffect.destroy();
    }

    private async highlightAllCode(): Promise<void> {
        const { default: Prism } = await import('prismjs');
        await import('prismjs/components/prism-markup');

        this.prismLoaded = true;
        this.loadPrismTheme(this.themeService.darkMode());

        this.codeContainers.forEach(container => {
            const pre = container.nativeElement;
            const codeBlock = pre.querySelector('code');
            const code = pre.getAttribute('data-code');

            if (codeBlock && code && !codeBlock.classList.contains('highlighted')) {
                codeBlock.textContent = code;
                codeBlock.classList.add('highlighted');
                Prism.highlightElement(codeBlock);
            }
        });
    }

    private loadPrismTheme(isDarkMode: boolean): void {
        const existingLink = document.getElementById('prism-theme') as HTMLLinkElement;
        const newHref = isDarkMode ? 'css/prism-okaidia.min.css' : 'css/prism.min.css';

        if (existingLink) {
            if (existingLink.href.endsWith(newHref)) return;
            existingLink.href = newHref;
        } else {
            const link = document.createElement('link');
            link.id = 'prism-theme';
            link.rel = 'stylesheet';
            link.href = newHref;
            document.head.appendChild(link);
        }
    }

    public getEscapedCode(code: string): string {
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    public async copyCode(code: string, index: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(code);
            this.copiedIndex.set(index);
            setTimeout(() => this.copiedIndex.set(null), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    }
}