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
    isOk: boolean;
}

export interface UrlData {
    href: string;                 // the page URL
    h1: string;                   // the page H1
    breadcrumb: BreadcrumbNode[]; // array of breadcrumbs
    descendants: string[];        // flat list of child pages urls
}

export interface BreadcrumbValidationState {
    progress: number;
    currentStep: string;
    isValidating: boolean;
    isValidated: boolean;
}

export interface BreadcrumbNode {
    label: string;            // link text
    url: string;              // link
    inScope?: boolean;        // true = user-added page, false = page added from breadcrumb for context
    iaOrphan?: boolean;       // true = IA orphan, false = link found on parent
    icon?: string;            // represents status of link from parent to child
    iconTooltip?: string;     // explanation for icon
    linkTooltip?: string;     // explanation for color/boldness of label
    styleClass?: string;      // for the label (used to set color and/or bold)
}

export interface AddPagesState {
    validation: ValidationState;
    breadcrumbs: BreadcrumbValidationState;
}