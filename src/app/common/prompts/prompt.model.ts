import { marker } from "@colsen1991/ngx-translate-extract-marker";

function markForTranslation() {
    marker('aiPrompt.inventory.description');
    marker('aiPrompt.inventory.keywords');
    marker('aiPrompt.inventory.translateDescription');
    marker('aiPrompt.inventory.translateKeywords');
    marker('aiPrompt.page.headings');
    marker('aiPrompt.page.doormats');
    marker('aiPrompt.page.plainLanguage');
    marker('aiPrompt.problem.alerts');
}

export enum InventoryPromptKey {
    Description = 'aiPrompt.inventory.description',
    Keywords = 'aiPrompt.inventory.keywords',
    TranslateDescription = 'aiPrompt.inventory.translateDescription',
    TranslateKeywords = 'aiPrompt.inventory.translateKeywords'
}

export enum PagePromptKey {
    Headings = 'aiPrompt.page.headings',
    Doormats = 'aiPrompt.page.doormats',
    PlainLanguage = 'aiPrompt.page.plainLanguage'
}

export enum ProblemPromptKey {
    Alerts = 'aiPrompt.problem.alerts',
}