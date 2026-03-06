import { marker } from "@colsen1991/ngx-translate-extract-marker";

function markForTranslation() {
    marker('aiPrompt.role.none');
    marker('aiPrompt.role.contentDesigner');
    marker('aiPrompt.role.seoExpert');
    marker('aiPrompt.role.accessibilityExpert');
    marker('aiPrompt.role.translator');

    marker('aiPrompt.output.text');
    marker('aiPrompt.output.html');
    marker('aiPrompt.output.json');

    marker('aiPrompt.rubric.noCommentary');
    marker('aiPrompt.rubric.preserveHtmlStructure');
    marker('aiPrompt.rubric.characterLimit');

    marker('aiPrompt.inventory.description');
    marker('aiPrompt.inventory.keywords');

    marker('aiPrompt.page.headings');
    marker('aiPrompt.page.doormats');
    marker('aiPrompt.page.plainLanguage');

    marker('aiPrompt.problem.alerts');
}

export interface PromptConfig {
    role: RoleKey;          // Shared
    task: string;           // Unique task
    rubric: RubricKey[];    // Shared
    output: OutputKey;      // Shared
    jsonSchema?: string;    // Unique schema
}

//Shared fragments
export enum RoleKey {
    None = 'aiPrompt.role.none',
    ContentDesigner = 'aiPrompt.role.contentDesigner',
    SeoExpert = 'aiPrompt.role.seoExpert',
    AccessibilityExpert = 'aiPrompt.role.accessibilityExpert',
    Translator = 'aiPrompt.role.translator',
}

export enum OutputKey {
    Text = 'aiPrompt.output.text',
    Html = 'aiPrompt.output.html',
    Json = 'aiPrompt.output.json',
}

export enum RubricKey {
    NoCommentary = 'aiPrompt.rubric.noCommentary',
    PreserveHtmlStructure = 'aiPrompt.rubric.preserveHtmlStructure',
    CharacterLimit = 'aiPrompt.rubric.characterLimit',
}

//Inventory task fragments
export enum InventoryPromptKey {
    Description = 'aiPrompt.inventory.description',
    Keywords = 'aiPrompt.inventory.keywords',
}

//Page task fragments
export enum PagePromptKey {
    Headings = 'aiPrompt.page.headings',
    Doormats = 'aiPrompt.page.doormats',
    PlainLanguage = 'aiPrompt.page.plainLanguage'
}

//Problem task fragments
export enum ProblemPromptKey {
    Alerts = 'aiPrompt.problem.alerts',
}