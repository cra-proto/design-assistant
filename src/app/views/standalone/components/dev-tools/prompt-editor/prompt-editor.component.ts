// Angular
import { Component, inject, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

// PrimeNG
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { FieldsetModule } from 'primeng/fieldset';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

// AIDA
import { RoleFragment, OutputFragment, RubricFragment } from '../../../../../common/prompts/shared.prompts';
import { InventoryPrompts } from '../../../../../common/prompts/inventory.prompts';
import { PagePrompts } from '../../../../../common/prompts/page.prompts';
import { ProblemPrompts } from '../../../../../common/prompts/problems.prompts';
import { PromptConfig, RoleKey, OutputKey, RubricKey, InventoryPromptKey, PagePromptKey, ProblemPromptKey } from '../../../../../common/prompts/prompt.model';
import { ExportGitHubService } from '../../../../../services/github/export-github.service';
import { UserSettingsService } from '../../../../../services/user-settings.service';
import { OpenRouterService, OpenRouterResponse } from '../../../../../services/ai/openrouter.service';
import { AiPromptService } from '../../../../../services/ai/prompt.service';

//Diff
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-slim';
import { ColorSchemeType } from 'diff2html/lib/types';

interface PromptEntry {
    enumKey: string;
    translationKey: string;
    promptText: string | PromptConfig;
}

interface TabConfig {
    title: string;
    value: number;
    prompts?: PromptEntry[];
    fragments?: { key: string; label: string; data: PromptEntry[] }[];
    tool: string;
    original: string;
}

@Component({
    selector: 'aida-prompt-editor',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule, RouterLink,
        BreadcrumbModule, TabsModule, TextareaModule, IftaLabelModule, FieldsetModule, ButtonModule, SelectModule, MultiSelectModule, CheckboxModule, RadioButtonModule,
        ProgressSpinnerModule, MessageModule
    ],
    templateUrl: './prompt-editor.component.html',
    styles: ``
})
export class PromptEditorComponent {
    private exportGitHubService = inject(ExportGitHubService);
    private settingsService = inject(UserSettingsService);
    private openRouterService = inject(OpenRouterService);
    private aiPromptService = inject(AiPromptService);

    // Breadcrumbs
    breadcrumbs = [{ label: 'dev._title', route: '/dev' }, { label: 'dev.prompts._title' }]

    constructor() {
        effect(() => {
            const isDarkMode = this.settingsService.darkMode();
            this.updateDiff();
        });
        effect(() => {
            const tab = this.selectedTab;
            this.updateDiff();
        });
    }

    // Type guard
    isPromptConfig(entry: PromptEntry): entry is PromptEntry & { promptText: PromptConfig } {
        return typeof entry.promptText === 'object' && entry.promptText !== null;
    }

    isPromptString(entry: PromptEntry): entry is PromptEntry & { promptText: string } {
        return typeof entry.promptText === 'string';
    }

    isFragmentsTab(tab: TabConfig): boolean {
        return tab.fragments !== undefined;
    }

    OutputKey = OutputKey

    // Shared prompt fragments
    roleFragment: PromptEntry[] = Object.keys(RoleKey).map(enumKey => ({
        enumKey,
        translationKey: RoleKey[enumKey as keyof typeof RoleKey],
        promptText: RoleFragment[RoleKey[enumKey as keyof typeof RoleKey]]
    }));

    outputFragment: PromptEntry[] = Object.keys(OutputKey).map(enumKey => ({
        enumKey,
        translationKey: OutputKey[enumKey as keyof typeof OutputKey],
        promptText: OutputFragment[OutputKey[enumKey as keyof typeof OutputKey]]
    }));

    rubricFragment: PromptEntry[] = Object.keys(RubricKey).map(enumKey => ({
        enumKey,
        translationKey: RubricKey[enumKey as keyof typeof RubricKey],
        promptText: RubricFragment[RubricKey[enumKey as keyof typeof RubricKey]]
    }));

    fragments = [
        { key: 'role', label: 'aiPrompt.component.role', data: this.roleFragment },
        { key: 'output', label: 'aiPrompt.component.output', data: this.outputFragment },
        { key: 'rubric', label: 'aiPrompt.component.rubric', data: this.rubricFragment }
    ];

    selectedFragment = 'role';

    toggleFragment(type: string) {
        this.selectedFragment = type;
    }

    isFragmentVisible(type: string): boolean {
        return this.selectedFragment === type;
    }

    // Dropdown values
    roleOptions = Object.values(RoleKey).map(key => ({
        value: key,
        label: key
    }));

    rubricOptions = Object.values(RubricKey).map(key => ({
        value: key,
        label: key
    }));

    outputOptions = Object.values(OutputKey).map(key => ({
        value: key,
        label: key
    }));

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

    selectedPrompts = new Set<string>([
        this.inventoryPrompts[0]?.enumKey,
        this.pagePrompts[0]?.enumKey,
        this.problemPrompts[0]?.enumKey
    ].filter(Boolean));

    togglePrompt(enumKey: string) {
        if (this.selectedPrompts.has(enumKey)) {
            this.selectedPrompts.delete(enumKey);
        } else {
            this.selectedPrompts.add(enumKey);
        }
    }

    isPromptVisible(enumKey: string): boolean {
        return this.selectedPrompts.has(enumKey);
    }

    // Tabs
    selectedTab = 0;
    tabs: TabConfig[] = [
        { title: 'aiPrompt.shared._title', value: 0, fragments: this.fragments, tool: "Shared", original: this.rebuildSharedFile() },
        { title: 'aiPrompt.inventory._title', value: 1, prompts: this.inventoryPrompts, tool: "Inventory", original: this.rebuildPromptFile('Inventory', this.inventoryPrompts) },
        { title: 'aiPrompt.pages._title', value: 2, prompts: this.pagePrompts, tool: "Page", original: this.rebuildPromptFile('Page', this.pagePrompts) },
        { title: 'aiPrompt.problems._title', value: 3, prompts: this.problemPrompts, tool: "Problem", original: this.rebuildPromptFile('Problem', this.problemPrompts) }
    ]

    markForTranslation() {
        marker('aiPrompt.shared._title');
        marker('aiPrompt.inventory._title');
        marker('aiPrompt.pages._title');
        marker('aiPrompt.problems._title');

        marker('aiPrompt.component.role');
        marker('aiPrompt.component.output');
        marker('aiPrompt.component.rubric');
        marker('aiPrompt.component.task');
        marker('aiPrompt.component.jsonSchema');

        marker('dev.prompts.button.openPR');
    }

    rebuildSharedFile() { return "" }
    rebuildPromptFile(tool: string, prompts: PromptEntry[]) { return "" }
    updateDiff() { }

    //For testing
    readonly aiState = this.openRouterService.state;
    aiPrompt = this.aiPromptService.composePrompt(InventoryPrompts[InventoryPromptKey.Metadata]);
    description = "Official CRA information on Canadian taxes. File your return, manage payments, and explore credits and deductions for individuals and businesses."
    response: OpenRouterResponse | null = null;
    result = ""

    async testResponse() {
        this.response = await this.openRouterService.sendToAI(
            InventoryPrompts[InventoryPromptKey.Metadata],
            this.description
        );
    }
    async testResult() {
        this.result = await this.openRouterService.getTextFromAI(
            InventoryPrompts[InventoryPromptKey.Metadata],
            this.description
        );
    }
}
