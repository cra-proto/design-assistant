import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { ColorSchemeType } from 'diff2html/lib/types';
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-slim';

import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FieldsetModule } from 'primeng/fieldset';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { TextareaModule } from 'primeng/textarea';

import { OpenRouterResponse, OpenRouterService } from '../../../../services/ai/openrouter.service';
import { AiPromptService } from '../../../../services/ai/prompt.service';
import { ExportGitHubService } from '../../../../services/github/export-github.service';
import { UserSettingsService } from '../../../../services/user-settings.service';

import { InventoryPrompts } from '../../../../common/prompts/inventory.prompts';
import { PagePrompts } from '../../../../common/prompts/page.prompts';
import { ProblemPrompts } from '../../../../common/prompts/problems.prompts';
import { InventoryPromptKey, OutputKey, PagePromptKey, ProblemPromptKey, PromptConfig, RoleKey, RubricKey } from '../../../../common/prompts/prompt.model';
import { OutputFragment, RoleFragment, RubricFragment } from '../../../../common/prompts/shared.prompts';

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
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    BreadcrumbModule,
    ButtonModule,
    CheckboxModule,
    FieldsetModule,
    IftaLabelModule,
    MessageModule,
    MultiSelectModule,
    ProgressSpinnerModule,
    RadioButtonModule,
    SelectModule,
    TabsModule,
    TextareaModule,
  ],
  templateUrl: './prompt-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptEditorComponent {
  private readonly exportGitHubService = inject(ExportGitHubService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly openRouterService = inject(OpenRouterService);
  private readonly aiPromptService = inject(AiPromptService);

  // Breadcrumbs
  protected readonly breadcrumbs = [{ label: 'dev._title', route: '/dev' }, { label: 'dev.prompts._title' }];

  constructor() {
    effect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const isDarkMode = this.settingsService.darkMode(); //watching for changes to dark mode to update diff theme
      this.updateDiff();
    });
    effect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const tab = this.selectedTab; //watching for changes to selected tab
      this.updateDiff();
    });
  }

  // Type guard
  protected isPromptConfig(entry: PromptEntry): entry is PromptEntry & { promptText: PromptConfig } {
    return typeof entry.promptText === 'object' && entry.promptText !== null;
  }

  protected isPromptString(entry: PromptEntry): entry is PromptEntry & { promptText: string } {
    return typeof entry.promptText === 'string';
  }

  protected isFragmentsTab(tab: TabConfig): boolean {
    return tab.fragments !== undefined;
  }

  protected readonly OutputKey = OutputKey;

  // Shared prompt fragments
  private readonly roleFragment: PromptEntry[] = Object.keys(RoleKey).map((enumKey) => ({
    enumKey,
    translationKey: RoleKey[enumKey as keyof typeof RoleKey],
    promptText: RoleFragment[RoleKey[enumKey as keyof typeof RoleKey]],
  }));

  private readonly outputFragment: PromptEntry[] = Object.keys(OutputKey).map((enumKey) => ({
    enumKey,
    translationKey: OutputKey[enumKey as keyof typeof OutputKey],
    promptText: OutputFragment[OutputKey[enumKey as keyof typeof OutputKey]],
  }));

  private readonly rubricFragment: PromptEntry[] = Object.keys(RubricKey).map((enumKey) => ({
    enumKey,
    translationKey: RubricKey[enumKey as keyof typeof RubricKey],
    promptText: RubricFragment[RubricKey[enumKey as keyof typeof RubricKey]],
  }));

  fragments = [
    { key: 'role', label: 'aiPrompt.component.role', data: this.roleFragment },
    { key: 'output', label: 'aiPrompt.component.output', data: this.outputFragment },
    { key: 'rubric', label: 'aiPrompt.component.rubric', data: this.rubricFragment },
  ];

  selectedFragment = 'role';

  toggleFragment(type: string) {
    this.selectedFragment = type;
  }

  isFragmentVisible(type: string): boolean {
    return this.selectedFragment === type;
  }

  // Dropdown values
  roleOptions = Object.values(RoleKey).map((key) => ({
    value: key,
    label: key,
  }));

  rubricOptions = Object.values(RubricKey).map((key) => ({
    value: key,
    label: key,
  }));

  outputOptions = Object.values(OutputKey).map((key) => ({
    value: key,
    label: key,
  }));

  // Prompts
  inventoryPrompts: PromptEntry[] = Object.keys(InventoryPromptKey).map((enumKey) => ({
    enumKey,
    translationKey: InventoryPromptKey[enumKey as keyof typeof InventoryPromptKey],
    promptText: InventoryPrompts[InventoryPromptKey[enumKey as keyof typeof InventoryPromptKey]],
  }));

  pagePrompts: PromptEntry[] = Object.keys(PagePromptKey).map((enumKey) => ({
    enumKey,
    translationKey: PagePromptKey[enumKey as keyof typeof PagePromptKey],
    promptText: PagePrompts[PagePromptKey[enumKey as keyof typeof PagePromptKey]],
  }));

  problemPrompts: PromptEntry[] = Object.keys(ProblemPromptKey).map((enumKey) => ({
    enumKey,
    translationKey: ProblemPromptKey[enumKey as keyof typeof ProblemPromptKey],
    promptText: ProblemPrompts[ProblemPromptKey[enumKey as keyof typeof ProblemPromptKey]],
  }));

  selectedPrompts = new Set<string>([this.inventoryPrompts[0]?.enumKey, this.pagePrompts[0]?.enumKey, this.problemPrompts[0]?.enumKey].filter(Boolean));

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
  selectedTab = 1;
  tabs: TabConfig[] = [
    { title: 'aiPrompt.shared._title', value: 0, fragments: this.fragments, tool: 'Shared', original: this.rebuildSharedFile() },
    { title: 'aiPrompt.inventory._title', value: 1, prompts: this.inventoryPrompts, tool: 'Inventory', original: this.rebuildPromptFile('Inventory', this.inventoryPrompts) },
    { title: 'aiPrompt.pages._title', value: 2, prompts: this.pagePrompts, tool: 'Page', original: this.rebuildPromptFile('Page', this.pagePrompts) },
    { title: 'aiPrompt.problems._title', value: 3, prompts: this.problemPrompts, tool: 'Problem', original: this.rebuildPromptFile('Problem', this.problemPrompts) },
  ];

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

  //For testing
  readonly aiState = this.openRouterService.state;
  aiPrompt = this.aiPromptService.composePrompt(InventoryPrompts[InventoryPromptKey.Metadata]);
  description = 'Official CRA information on Canadian taxes. File your return, manage payments, and explore credits and deductions for individuals and businesses.';
  response: OpenRouterResponse | null = null;
  result = '';

  async testResponse() {
    this.response = await this.openRouterService.sendToAI(InventoryPrompts[InventoryPromptKey.Metadata], this.description);
  }
  async testResult() {
    this.result = await this.openRouterService.getTextFromAI(InventoryPrompts[InventoryPromptKey.Metadata], this.description);
  }

  //TODO: test this
  // Rebuild prompt file
  rebuildPromptFile(tool: string, prompts: PromptEntry[]) {
    const updatedPrompts = prompts.map((p) => ` [${tool}PromptKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    return `import { ${tool}PromptKey } from './prompt.model'\nexport const ${tool}Prompts: Record<${tool}PromptKey, string> = {\n${updatedPrompts}\n};`;
  }

  rebuildSharedFile(): string {
    const roleEntries = this.roleFragment.map((p) => ` [RoleKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    const outputEntries = this.outputFragment.map((p) => ` [OutputKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    const rubricEntries = this.rubricFragment.map((p) => ` [RubricKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    return `import { RoleKey, OutputKey, RubricKey } from './prompt.model'

    export const RoleFragment: Record<RoleKey, string> = {
        ${roleEntries}
        }

        export const OutputFragment: Record<OutputKey, string> = {
            ${outputEntries}
            }

            export const RubricFragment: Record<RubricKey, string> = {
                ${rubricEntries}
                }`;
  }

  // Tracks if changes have been made to current tab
  hasChanges(): boolean {
    if (!this.selectedTab) return false;
    const prompts = this.tabs[this.selectedTab].prompts;
    if (!prompts) return false;
    const tab = this.tabs[this.selectedTab];
    const updatedContent = this.rebuildPromptFile(tab.tool, prompts);
    const originalContent = tab.original;
    return updatedContent !== originalContent;
  }

  // Open pull request
  pullRequestUrl: string | null = null;
  async openPullRequest(tool: string, prompts: PromptEntry[]) {
    const content = this.rebuildPromptFile(tool, prompts);
    const toolLC = tool.toLowerCase();
    try {
      const result = await this.exportGitHubService.createPullRequestForPrompts(toolLC, `src/app/common/prompts/${toolLC}.prompts.ts`, `${toolLC}.prompts.ts`, content);
      this.pullRequestUrl = result.prUrl;
    } catch (error) {
      console.error('Failed to create PR:', error);
    }
  }

  // Update prompts diff
  protected readonly diffContainer = viewChild<ElementRef<HTMLElement>>('diffContainer');
  async updateDiff() {
    const diffContainer = this.diffContainer();
    if (!diffContainer) return;
    const prompts = this.tabs[this.selectedTab].prompts;
    if (!prompts) return;
    // Lazy load both modules
    const [{ createPatch }, { Diff2HtmlUI }] = await Promise.all([import('diff'), import('diff2html/lib/ui/js/diff2html-ui-slim')]);
    const tab = this.tabs[this.selectedTab];
    const updatedContent = this.rebuildPromptFile(tab.tool, prompts);
    const originalContent = tab.original;

    // Create the patch
    const patch = createPatch(`${tab.tool.toLowerCase()}.prompts.ts`, originalContent, updatedContent);

    // Render it
    const config: Diff2HtmlUIConfig = {
      drawFileList: false,
      matching: 'words',
      outputFormat: 'line-by-line', // or 'side-by-side'
      highlight: true,
      colorScheme: this.settingsService.darkMode() ? ColorSchemeType.DARK : ColorSchemeType.LIGHT,
    };

    const diff2htmlUi = new Diff2HtmlUI(diffContainer.nativeElement, patch, config);

    diff2htmlUi.draw();
    this.highlightFilePreview();
  }

  // Highlight code for export preview
  protected readonly filePreview = viewChild<ElementRef<HTMLPreElement>>('filePreview');
  async highlightFilePreview(): Promise<void> {
    const filePreview = this.filePreview();
    if (!filePreview) return;
    const prompts = this.tabs[this.selectedTab].prompts;
    if (!prompts) return;

    try {
      const { default: Prism } = await import('prismjs');
      await import('prismjs/components/prism-typescript');

      this.loadPrismTheme(this.settingsService.darkMode());

      const pre = filePreview.nativeElement;
      const codeBlock = pre.querySelector('code');

      if (codeBlock) {
        pre.className = ''; // Clear pre classes
        pre.removeAttribute('data-highlighted');
        pre.removeAttribute('tabindex');
        codeBlock.className = 'language-typescript';
        codeBlock.textContent = this.rebuildPromptFile(this.tabs[this.selectedTab].tool, prompts);
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
