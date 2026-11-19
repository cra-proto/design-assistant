import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ColorSchemeType } from 'diff2html/lib/types';
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-slim';

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
import { SignInService } from '../../../../services/github/sign-in.service';
import { StyleCardService } from '../../../../services/style-card.service';
import { UserSettingsService } from '../../../../services/user-settings.service';

import { PagePrompts } from '../../../../common/prompts/page.prompts';
import { ProblemPrompts } from '../../../../common/prompts/problems.prompts';
import { OutputKey, PagePromptKey, ProblemPromptKey, PromptConfig, RoleKey, RubricKey, ToolsPromptKey } from '../../../../common/prompts/prompt.model';
import { OutputFragment, RoleFragment, RubricFragment } from '../../../../common/prompts/shared.prompts';
import { ToolsPrompts } from '../../../../common/prompts/tools.prompts';

interface PromptEntry {
  enumKey: string;
  translationKey: string;
  promptText: string | string[] | PromptConfig;
}

interface TabConfig {
  title: string;
  description: string;
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
    TranslatePipe,
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
  styles: `
    pre.prompt-preview {
      display: block;
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      font-size: 1rem;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere;
      word-break: break-word;
      overflow-x: hidden;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromptEditorComponent {
  private readonly translate = inject(TranslateService);
  private readonly exportGitHubService = inject(ExportGitHubService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly openRouterService = inject(OpenRouterService);
  private readonly aiPromptService = inject(AiPromptService);
  protected readonly signInService = inject(SignInService);
  protected readonly styleCardService = inject(StyleCardService);

  constructor() {
    effect(() => {
      void this.settingsService.darkMode(); //watching for changes to dark mode to update diff theme
      this.updateDiff();
    });
    effect(() => {
      const tab = this.selectedTab(); //watching for changes to selected tab
      if (tab < 5) {
        this.selectedPromptTab.set(tab);
      }
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
    { key: 'role', label: marker('aiPrompt.component.role'), data: this.roleFragment },
    { key: 'output', label: marker('aiPrompt.component.output'), data: this.outputFragment },
    { key: 'rubric', label: marker('aiPrompt.component.rubric'), data: this.rubricFragment },
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

  protected readonly rubricOptions = computed(() => {
    this.translate.currentLang();
    return Object.values(RubricKey).map((key) => ({
      value: key,
      label: this.translate.instant(key),
    }));
  });

  outputOptions = Object.values(OutputKey).map((key) => ({
    value: key,
    label: key,
  }));

  // Prompts
  inventoryPrompts: PromptEntry[] = Object.keys(ToolsPromptKey).map((enumKey) => ({
    enumKey,
    translationKey: ToolsPromptKey[enumKey as keyof typeof ToolsPromptKey],
    promptText: ToolsPrompts[ToolsPromptKey[enumKey as keyof typeof ToolsPromptKey]],
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
  protected readonly selectedTab = signal<number>(1);
  protected readonly selectedPromptTab = signal<number>(1);
  tabs: TabConfig[] = [
    { title: marker('aiPrompt.shared._title'), description: marker('aiPrompt.shared._description'), value: 0, fragments: this.fragments, tool: 'Shared', original: this.rebuildSharedFile() },
    {
      title: marker('aiPrompt.tools._title'),
      description: marker('aiPrompt.tools._description'),
      value: 1,
      prompts: this.inventoryPrompts,
      tool: 'Tools',
      original: this.rebuildPromptFile('Tools', this.inventoryPrompts),
    },
    {
      title: marker('aiPrompt.page._title'),
      description: marker('aiPrompt.page._description'),
      value: 2,
      prompts: this.pagePrompts,
      tool: 'Page',
      original: this.rebuildPromptFile('Page', this.pagePrompts),
    },
    {
      title: marker('aiPrompt.problems._title'),
      description: marker('aiPrompt.problems._description'),
      value: 3,
      prompts: this.problemPrompts,
      tool: 'Problem',
      original: this.rebuildPromptFile('Problem', this.problemPrompts),
    },
  ];

  // Dropdown
  protected readonly promptGroups = [
    { label: 'aiPrompt.tools._title', items: this.inventoryPrompts },
    { label: 'aiPrompt.page._title', items: this.pagePrompts },
    { label: 'aiPrompt.problems._title', items: this.problemPrompts },
  ];
  protected readonly selectedPrompt = signal<PromptEntry | undefined>(this.problemPrompts.find((p) => p.enumKey === 'Alerts'));
  protected readonly aiPrompt = computed(() => {
    const selected = this.selectedPrompt();
    if (!selected || !this.isPromptConfig(selected)) return '';
    return this.aiPromptService.composePrompt(selected.promptText);
  });

  // Test prompts
  readonly aiState = this.openRouterService.state;
  description = 'Official CRA information on Canadian taxes. File your return, manage payments, and explore credits and deductions for individuals and businesses.';
  response: OpenRouterResponse | null = null;
  result = '';

  async testResponse() {
    const config = this.getSelectedPromptConfig();
    if (!config) return;
    this.response = await this.openRouterService.sendToAI(config, this.description);
  }
  async testResult() {
    const config = this.getSelectedPromptConfig();
    if (!config) return;
    this.result = await this.openRouterService.getTextFromAI(config, this.description);
  }

  // Rebuild prompt file
  rebuildPromptFile(tool: string, prompts: PromptEntry[]) {
    const updatedPrompts = prompts
      .map((prompt) => {
        let value: string;
        if (this.isPromptConfig(prompt)) {
          value = this.serializePromptConfig(prompt.promptText);
        } else if (this.isPromptString(prompt)) {
          value = this.toTemplateLiteral(prompt.promptText);
        } else {
          throw new Error(`Unsupported prompt value for ${prompt.enumKey}`);
        }
        return `\t[${tool}PromptKey.${prompt.enumKey}]: ${value},`;
      })
      .join('\n');

    const imports = ['OutputKey', `${tool}PromptKey`, 'PromptConfig', 'RoleKey', 'RubricKey'].sort();

    return `import { ${imports.join(', ')} } from './prompt.model';\n\nexport const ${tool}Prompts: Record<${tool}PromptKey, PromptConfig> = {\n${updatedPrompts}\n};\n`;
  }

  protected getSelectedPromptConfig(): PromptConfig | null {
    const selected = this.selectedPrompt();
    return selected && this.isPromptConfig(selected) ? selected.promptText : null;
  }

  private serializePromptConfig(config: PromptConfig): string {
    const lines = [
      '{',
      `\t\trole: RoleKey.${this.getEnumKey(RoleKey, config.role)},`,
      `\t\ttask: ${this.toTemplateLiteral(config.task)},`,
      `\t\trubric: [${config.rubric.map((rubric) => `RubricKey.${this.getEnumKey(RubricKey, rubric)}`).join(', ')}],`,
      `\t\toutput: OutputKey.${this.getEnumKey(OutputKey, config.output)},`,
    ];

    if (config.jsonSchema !== undefined) lines.push(`\t\tjsonSchema: ${this.toTemplateLiteral(config.jsonSchema)},`);
    if (config.examples !== undefined) lines.push(`\t\texamples: ${this.toTemplateLiteral(config.examples)},`);
    if (config.available !== undefined) lines.push(`\t\tavailable: ${config.available},`);
    lines.push('  }');
    return lines.join('\n');
  }

  private getEnumKey<T extends Record<string, string>>(enumObject: T, value: T[keyof T]): string {
    const key = Object.entries(enumObject).find(([, enumValue]) => enumValue === value)?.[0];
    if (!key) throw new Error(`Unknown prompt enum value: ${value}`);
    return key;
  }

  private toTemplateLiteral(value: string): string {
    return `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
  }

  // Rebuild prompt file (older version)
  rebuildPromptFileOld(tool: string, prompts: PromptEntry[]) {
    const updatedPrompts = prompts.map((p) => ` [${tool}PromptKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    return `import { ${tool}PromptKey } from './prompt.model'\nexport const ${tool}Prompts: Record<${tool}PromptKey, string> = {\n${updatedPrompts}\n};`;
  }

  rebuildSharedFile(): string {
    const roleEntries = this.roleFragment.map((p) => `\t[RoleKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    const outputEntries = this.outputFragment.map((p) => `\t[OutputKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

    const rubricEntries = this.rubricFragment.map((p) => `\t[RubricKey.${p.enumKey}]: \`${p.promptText}\`,`).join('\n');

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

  /** Tracks if changes have been made to current tab */
  hasChanges(promptTab?: number): boolean {
    const tabNumber = promptTab ?? this.selectedPromptTab();
    const tab = this.tabs[tabNumber];
    if (tabNumber === 0) {
      const updatedContent = this.rebuildSharedFile();
      const originalContent = tab.original;
      return updatedContent !== originalContent;
    }
    if (!tab?.prompts) return false;
    const updatedContent = this.rebuildPromptFile(tab.tool, tab.prompts);
    const originalContent = tab.original;
    return updatedContent !== originalContent;
  }

  // Open pull request
  pullRequestUrl: string | null = null;
  /** Open pull request for selected tab */
  async openPullRequest(tool: string, prompts?: PromptEntry[]) {
    const content = !prompts ? this.rebuildSharedFile() : this.rebuildPromptFile(tool, prompts);
    const toolLC = tool.toLowerCase();
    try {
      const result = await this.exportGitHubService.createPullRequestForPrompts(toolLC, `src/app/common/prompts/${toolLC}.prompts.ts`, `${toolLC}.prompts.ts`, content);
      this.pullRequestUrl = result.prUrl;
    } catch (error) {
      console.error('Failed to create PR:', error);
    }
  }

  /** Update prompts diff */
  protected readonly diffContainer = viewChild<ElementRef<HTMLElement>>('diffContainer');
  async updateDiff() {
    const diffContainer = this.diffContainer();
    if (!diffContainer) return;

    // Lazy load both modules
    const [{ createPatch }, { Diff2HtmlUI }] = await Promise.all([import('diff'), import('diff2html/lib-esm/ui/js/diff2html-ui-slim')]);
    const tab = this.tabs[this.selectedPromptTab()];
    const updatedContent = this.selectedPromptTab() === 0 ? this.rebuildSharedFile() : tab.prompts ? this.rebuildPromptFile(tab.tool, tab.prompts) : '';
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

  /** Highlight code for export preview */
  protected readonly filePreview = viewChild<ElementRef<HTMLPreElement>>('filePreview');
  async highlightFilePreview(): Promise<void> {
    const filePreview = this.filePreview();
    if (!filePreview) return;
    const prompts = this.tabs[this.selectedPromptTab()].prompts;
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
        codeBlock.textContent = this.rebuildPromptFile(this.tabs[this.selectedPromptTab()].tool, prompts);
        Prism.highlightElement(codeBlock);
      }
    } catch (error) {
      console.error('Failed to load Prism:', error);
    }
  }

  /** Load light/dark prism theme */
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
