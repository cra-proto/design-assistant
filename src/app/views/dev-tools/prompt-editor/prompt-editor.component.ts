// Angular
import { Component, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

// PrimeNG
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { FieldsetModule } from 'primeng/fieldset';
import { ButtonModule } from 'primeng/button';

// AIDA
import { InventoryPrompts } from '../../../common/prompts/inventory.prompts';
import { PagePrompts } from '../../../common/prompts/page.prompts';
import { ProblemPrompts } from '../../../common/prompts/problems.prompts';
import { InventoryPromptKey, PagePromptKey, ProblemPromptKey } from '../../../common/prompts/prompt.model';
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { ThemeService } from '../../../services/theme.service';

//Diff
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-slim';
import { ColorSchemeType } from 'diff2html/lib/types';

interface PromptEntry {
    enumKey: string;
    translationKey: string;
    promptText: string;
}

interface TabConfig {
    title: string;
    value: number;
    prompts: PromptEntry[];
    tool: string;
    original: string;
}

@Component({
    selector: 'aida-prompt-editor',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule, RouterLink,
        BreadcrumbModule, TabsModule, TextareaModule, IftaLabelModule, FieldsetModule, ButtonModule
    ],
    templateUrl: './prompt-editor.component.html',
    styles: ``
})
export class PromptEditorComponent {
    exportGithub = inject(ExportGitHubService);
    themeService = inject(ThemeService);

    // Breadcrumbs
    breadcrumbs = [{ label: 'example._title', route: '/dev' }, { label: 'example.prompt._title' }]

    constructor() {
        effect(() => {
            const isDarkMode = this.themeService.darkMode();
            this.updateDiff();
        });
        effect(() => {
            const tab = this.selectedTab;
            this.updateDiff();
        });
    }
    // Prompts
    inventoryPrompts: PromptEntry[] = Object.keys(InventoryPromptKey).map(enumKey => ({
        enumKey,
        translationKey: InventoryPromptKey[enumKey as keyof typeof InventoryPromptKey],
        promptText: InventoryPrompts[InventoryPromptKey[enumKey as keyof typeof InventoryPromptKey]]
    }));

    pagePrompts: PromptEntry[] = Object.keys(PagePromptKey).map(enumKey => ({
        enumKey,
        translationKey: PagePromptKey[enumKey as keyof typeof PagePromptKey],
        promptText: PagePrompts[PagePromptKey[enumKey as keyof typeof PagePromptKey]]
    }));

    problemPrompts: PromptEntry[] = Object.keys(ProblemPromptKey).map(enumKey => ({
        enumKey,
        translationKey: ProblemPromptKey[enumKey as keyof typeof ProblemPromptKey],
        promptText: ProblemPrompts[ProblemPromptKey[enumKey as keyof typeof ProblemPromptKey]]
    }));

    // Tabs
    selectedTab = 0;
    tabs: TabConfig[] = [
        { title: 'aiPrompt.inventory._title', value: 0, prompts: this.inventoryPrompts, tool: "Inventory", original: this.rebuildPromptFile('Inventory', this.inventoryPrompts) },
        { title: 'aiPrompt.pages._title', value: 1, prompts: this.pagePrompts, tool: "Page", original: this.rebuildPromptFile('Page', this.pagePrompts) },
        { title: 'aiPrompt.problems._title', value: 2, prompts: this.problemPrompts, tool: "Problem", original: this.rebuildPromptFile('Problem', this.problemPrompts) }
    ]

    // Rebuild prompt file
    rebuildPromptFile(tool: string, prompts: PromptEntry[]) {
        const updatedPrompts = prompts
            .map(p => `  [${tool}PromptKey.${p.enumKey}]: \`${p.promptText}\`,`)
            .join('\n');

        return `import { ${tool}PromptKey } from './prompt.model'\nexport const ${tool}Prompts: Record<${tool}PromptKey, string> = {\n${updatedPrompts}\n};`;
    }

    // Tracks if changes have been made to current tab
    hasChanges(): boolean {
        const tab = this.tabs[this.selectedTab];
        const updatedContent = this.rebuildPromptFile(tab.tool, tab.prompts);
        const originalContent = tab.original;
        return updatedContent !== originalContent;
    }

    // Open pull request
    pullRequestUrl: string | null = null
    async openPullRequest(tool: string, prompts: PromptEntry[]) {
        const content = this.rebuildPromptFile(tool, prompts);
        const toolLC = tool.toLowerCase();
        try {
            const result = await this.exportGithub.createPullRequestForPrompts(
                toolLC,
                `src/app/common/prompts/${toolLC}.prompts.ts`,
                `${toolLC}.prompts.ts`,
                content
            );
            this.pullRequestUrl = result.prUrl
        } catch (error) {
            console.error('Failed to create PR:', error);
        }
    }

    // Update prompts diff
    async updateDiff() {
        // Lazy load both modules
        const [{ createPatch }, { Diff2HtmlUI }] = await Promise.all([
            import('diff'),
            import('diff2html/lib/ui/js/diff2html-ui-slim'),
        ]);
        const tab = this.tabs[this.selectedTab];
        const updatedContent = this.rebuildPromptFile(tab.tool, tab.prompts);
        const originalContent = tab.original;

        // Create the patch
        const patch = createPatch(
            `${tab.tool.toLowerCase()}.prompts.ts`,
            originalContent,
            updatedContent,
        );

        // Render it
        const config: Diff2HtmlUIConfig = {
            drawFileList: false,
            matching: 'words',
            outputFormat: 'line-by-line', // or 'side-by-side'
            highlight: true,
            colorScheme: this.themeService.darkMode() ? ColorSchemeType.DARK : ColorSchemeType.LIGHT
        };

        const diff2htmlUi = new Diff2HtmlUI(
            document.getElementById('diff-container')!,
            patch,
            config
        );

        diff2htmlUi.draw();
        this.highlightFilePreview();
    }

    // Highlight code for export preview
    @ViewChild('filePreview') filePreview?: ElementRef<HTMLPreElement>;
    async highlightFilePreview(): Promise<void> {
        if (!this.filePreview) return;

        try {
            const { default: Prism } = await import('prismjs');
            await import('prismjs/components/prism-typescript');

            this.loadPrismTheme(this.themeService.darkMode());

            const pre = this.filePreview.nativeElement;
            const codeBlock = pre.querySelector('code');

            if (codeBlock) {
                pre.className = '';  // Clear pre classes
                pre.removeAttribute('data-highlighted');
                pre.removeAttribute('tabindex');
                codeBlock.className = 'language-typescript';
                codeBlock.textContent = this.rebuildPromptFile(
                    this.tabs[this.selectedTab].tool,
                    this.tabs[this.selectedTab].prompts
                );
                Prism.highlightElement(codeBlock);
            }
        } catch (error) {
            console.error('Failed to load Prism:', error);
        }
    }

    // Load light/dark prism theme
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
}
