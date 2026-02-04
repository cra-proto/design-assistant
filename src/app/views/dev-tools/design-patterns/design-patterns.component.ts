import { Component, effect, OnDestroy, AfterViewInit, ViewChildren, QueryList, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabsModule } from 'primeng/tabs';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { IftaLabelModule } from 'primeng/iftalabel';
import { TooltipModule } from "primeng/tooltip";

import { ThemeService } from '../../../services/theme.service';

interface CodeExample {
    label: string;
    code: string;
    description?: string;
    previewType: 'message' | 'buttons' | 'card' | 'input';
    previewConfig?: any;
}

@Component({
    selector: 'aida-design-patterns',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule, RouterLink,
        BreadcrumbModule, TabsModule, MessageModule, ButtonModule, TooltipModule,
        InputTextModule, TextareaModule, SelectModule, IftaLabelModule,
    ],
    templateUrl: './design-patterns.component.html',
    styleUrl: './design-patterns.component.css'
})
export class DesignPatternsComponent implements AfterViewInit, OnDestroy {
    public themeService = inject(ThemeService);

    @ViewChildren('codeContainer') codeContainers!: QueryList<ElementRef>;

    breadcrumbs = [{ label: 'example._title', route: '/test' }, { label: 'example.patterns._title' }];

    private darkModeEffect;
    private prismLoaded = false;
    public copiedIndex = signal<string | null>(null);

    public messageExamples: CodeExample[] = [
        {
            label: 'Info',
            code: `<p-message severity="info" icon="pi pi-info-circle font-bold" [text]="'example.message.info' | translate" />`,
            description: 'example.pattern.message.info.desc',
            previewType: 'message',
            previewConfig: {
                severity: 'info',
                icon: 'pi pi-info-circle font-bold',
                text: 'example.message.info'
            }
        },
        {
            label: 'Success',
            code: `<p-message severity="success" icon="pi pi-check-circle font-bold" [text]="'example.message.success' | translate" />`,
            description: 'example.pattern.message.success.desc',
            previewType: 'message',
            previewConfig: {
                severity: 'success',
                icon: 'pi pi-check-circle font-bold',
                text: 'example.message.success'
            }
        },
        {
            label: 'Warning',
            code: `<p-message severity="warn" icon="pi pi-exclamation-triangle font-bold" [text]="'example.message.warn' | translate" />`,
            description: 'example.pattern.message.warn.desc',
            previewType: 'message',
            previewConfig: {
                severity: 'warn',
                icon: 'pi pi-exclamation-triangle font-bold',
                text: 'example.message.warn'
            }
        },
        {
            label: 'Error',
            code: `<p-message severity="error" icon="pi pi-times-circle font-bold" [text]="'example.message.error' | translate" />`,
            description: 'example.pattern.message.error.desc',
            previewType: 'message',
            previewConfig: {
                severity: 'error',
                icon: 'pi pi-times-circle font-bold',
                text: 'example.message.error'
            }
        },
        {
            label: 'Text version',
            code: `<p-message variant="simple" size="small" severity="error" [text]="'example.message.error' | translate" />`,
            description: 'example.pattern.message.error.desc',
            previewType: 'message',
            previewConfig: {
                variant: 'simple',
                size: 'small',
                severity: 'error',
                text: 'example.message.error'
            }
        }
    ];

    public buttonExamples: CodeExample[] = [
        {
            label: 'Primary & Secondary Outline',
            code: `<div class="flex gap-2">
    <p-button [label]="'example.button.save' | translate" icon="pi pi-check" />
    <p-button [label]="'example.button.cancel' | translate" icon="pi pi-times" severity="secondary" outlined styleClass='secondary-outline' />
</div>`,
            description: 'example.pattern.button.primary.desc',
            previewType: 'buttons',
            previewConfig: {
                type: 'primary-secondary',
                buttons: [
                    { label: 'example.button.save', icon: 'pi pi-check' },
                    { label: 'example.button.cancel', icon: 'pi pi-times', severity: 'secondary', outlined: true, styleClass: 'secondary-outline' }
                ]
            }
        },
        {
            label: 'Danger & Secondary Outline',
            code: `<div class="flex gap-2">
    <p-button [label]="'example.button.delete' | translate" icon="pi pi-trash" severity="danger" />
    <p-button [label]="'example.button.cancel' | translate" icon="pi pi-times" severity="secondary" outlined styleClass='secondary-outline' />
</div>`,
            description: 'example.pattern.button.danger.desc',
            previewType: 'buttons',
            previewConfig: {
                type: 'danger-secondary',
                buttons: [
                    { label: 'example.button.delete', icon: 'pi pi-trash', severity: 'danger' },
                    { label: 'example.button.cancel', icon: 'pi pi-times', severity: 'secondary', outlined: true, styleClass: 'secondary-outline' }
                ]
            }
        },
        {
            label: 'Secondary Task Button',
            code: `<p-button [label]="'example.button.task' | translate" icon="pi pi-cog" outlined styleClass="secondary-outline" />`,
            description: 'example.pattern.button.task.desc',
            previewType: 'buttons',
            previewConfig: {
                type: 'task',
                buttons: [
                    { label: 'example.button.task', icon: 'pi pi-cog', outlined: true, styleClass: 'secondary-outline' }
                ]
            }
        },
        {
            label: 'Icon Buttons',
            code: `<div class="flex gap-2">
    <p-button icon="pi pi-trash" severity="danger" text rounded [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
    <p-button icon="pi pi-share-alt" severity="primary" text rounded [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
    <p-button icon="pi pi-sync" severity="primary" [pTooltip]="'example.button.icon' | translate" tooltipPosition="top" />
</div>`,
            description: 'example.pattern.button.icon.desc',
            previewType: 'buttons',
            previewConfig: {
                type: 'icon',
                buttons: [
                    { icon: 'pi pi-trash', severity: 'danger', text: true, rounded: true, tooltip: 'example.button.icon' },
                    { icon: 'pi pi-share-alt', severity: 'primary', text: true, rounded: true, tooltip: 'example.button.icon' },
                    { icon: 'pi pi-sync', severity: 'primary', tooltip: 'example.button.icon' }
                ]
            }
        }
    ];

    public cardExamples: CodeExample[] = [
        {
            label: 'Card',
            code: `<div class="surface-card border-round-lg shadow-2 p-4 w-full min-w-min">
    <!-- Content here -->
</div>`,
            description: 'example.pattern.card.standard.desc',
            previewType: 'card',
            previewConfig: {
                type: 'standard',
                content: 'Example content in a standard card'
            }
        },
        {
            label: 'Card with hover effect',
            code: `<div class="surface-card border-round-lg shadow-1 hover:shadow-3 p-4 w-full min-w-min">
    <!-- Content here -->
</div>`,
            description: 'example.pattern.card.hover.desc',
            previewType: 'card',
            previewConfig: {
                type: 'hover',
                content: 'Example content in a hover card'
            }
        }
    ];

    public inputExamples: CodeExample[] = [
        {
            label: 'Input Text with IFTA Label',
            code: `<p-iftaLabel>
    <input pInputText id="example-input" [(ngModel)]="value" fluid />
    <label for="example-input">{{ 'example.input.label' | translate }}</label>
</p-iftaLabel>`,
            description: 'example.pattern.input.text.desc',
            previewType: 'input',
            previewConfig: {
                type: 'text',
                id: 'example-input',
                label: 'example.input.label',
                model: 'exampleValue'
            }
        },
        {
            label: 'Textarea with IFTA Label',
            code: `<p-iftaLabel>
    <textarea pInputTextarea id="example-textarea" [(ngModel)]="value" rows="3" fluid></textarea>
    <label for="example-textarea">{{ 'example.input.textarea.label' | translate }}</label>
</p-iftaLabel>`,
            description: 'example.pattern.input.textarea.desc',
            previewType: 'input',
            previewConfig: {
                type: 'textarea',
                id: 'example-textarea',
                label: 'example.input.textarea.label',
                rows: 3,
                model: 'exampleTextarea'
            }
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
            description: 'example.pattern.input.select.desc',
            previewType: 'input',
            previewConfig: {
                type: 'select',
                id: 'example-select',
                label: 'example.input.select.label',
                model: 'selectedOption'
            }
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
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
            this.highlightAllCode();
        }, 100);

        // Re-highlight when code containers change (e.g., tab switching)
        this.codeContainers.changes.subscribe(() => {
            setTimeout(() => {
                this.highlightAllCode();
            }, 100);
        });
    }

    ngOnDestroy(): void {
        this.darkModeEffect.destroy();
    }

    private async highlightAllCode(): Promise<void> {
        try {
            const { default: Prism } = await import('prismjs');
            await import('prismjs/components/prism-markup');

            this.prismLoaded = true;
            this.loadPrismTheme(this.themeService.darkMode());

            this.codeContainers.forEach(container => {
                const pre = container.nativeElement;
                const codeBlock = pre.querySelector('code');
                const code = pre.getAttribute('data-code');

                if (codeBlock && code) {
                    // Clear previous content and highlighting
                    codeBlock.className = 'language-html';
                    codeBlock.textContent = code;
                    Prism.highlightElement(codeBlock);
                }
            });
        } catch (error) {
            console.error('Failed to load Prism:', error);
        }
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