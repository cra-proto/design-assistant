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

export interface PageMetadata {
    doubleH1: string              // the page double H1 (if any, otherwise empty string)
    h1: string;                   // the page H1
    title: string;                // the page title
    description: string;          // the page description
    keywords: string;             // the page keywords
    template: string;             // autodetected template
    oppUrl?: string               // opposite language url
    isArchived?: boolean          // archive status
    linksToPortal?: boolean       // true if page links to a secure portal
    noindex: boolean              // from page robots
    wordCount: number             // calculated from page content
}

export interface OppMetadata {
    h1: string;                   // the page H1
    doubleH1: string;             // the page double H1 (if any)
    title: string;                // the page title
    description: string;          // the page description
    keywords: string;             // the page keywords
    noindex: boolean              // from page robots
}

export interface JsonMetadata {
    oppTitle?: string;              // jrc:content.json otherTitle
    owner?: string;                 // jrc:content.json gcContributor
    email?: string;                 // jrc:content.json gcBranch
    lastPublished?: Date;           // jrc:content.json gcLastPublished
    lastModified?: Date;            // jrc:content.json cq:lastModified
    isFreestyle?: boolean           // jrc:content.json cq:template
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