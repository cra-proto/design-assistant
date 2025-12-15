export interface UrlItem {
    href: string;
    status: 'ok' | 'bad' | 'redirect' | 'blocked' | 'checking';
    originalHref?: string;
}

export interface ValidationState {
    rawUrls: string;
    urls: UrlItem[];
    urlTotal: number;
    urlChecked: number;
    urlPercent: number;
    isValidating: boolean;
    isValidated: boolean;
}

export interface BreadcrumbNode {
    label: string;            // link text
    url: string;              // link
    isRoot?: boolean;         // marks if it's one of the detected root pages (from user input)
    isBeforeRoot?: boolean;   // marks if it's before the first root page (from user input)
    isDescendant?: boolean;   // mark if it's a child page (from user input)
    valid?: boolean;          // true = link found on parent, false = IA orphan
    styleClass?: string;      // for the label (used to set color and/or bold)
    icon?: string;            // represents status of link from parent to child
    iconTooltip?: string;     // explanation for icon
    linkTooltip?: string;     // explanation for color/boldness of label
    prototype?: string;       // carry forward the prototype link
    minDepth?: number;         // carry forward how far to crawl from root to deepest user added child
}



export interface BreadcrumbValidationState {
    isValidating: boolean;
    progress: number;
    currentStep: string;
    isComplete: boolean;
}

export interface AddPagesState {
    validation: ValidationState;
    breadcrumbs: BreadcrumbValidationState;
}