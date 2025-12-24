import { Injectable, signal, computed, inject } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { AddPagesState, UrlItem, ValidationState, BreadcrumbValidationState, BreadcrumbNode } from '../add-pages.model';

@Injectable({
    providedIn: 'root'
})
export class AddPagesStateService {

    // URL validation state
    private validationState = signal<ValidationState>({
        rawUrls: '',
        urls: [],
        urlTotal: 0,
        urlChecked: 0,
        urlPercent: 0,
        isValidating: false,
        isValidated: false,
        isOk: false,
    });

    getValidationState = computed(() => this.validationState());

    setValidationState(partial: Partial<ValidationState>) {
        this.validationState.update(curr => ({ ...curr, ...partial }));
    }

    // Breadcrumb validation state
    private breadcrumbState = signal<BreadcrumbValidationState>({
        progress: 0,
        currentStep: '',
        isValidating: false,
        isValidated: false,
    });

    getBreadcrumbState = computed(() => this.breadcrumbState());

    setBreadcrumbState(partial: Partial<BreadcrumbValidationState>) {
        this.breadcrumbState.update(curr => ({ ...curr, ...partial }));
    }

    // Previous project data for undo
    private previousProjectData = signal<TreeNode[] | null>(null);
    getPreviousProjectData = computed(() => this.previousProjectData());
    setPreviousProjectData(data: TreeNode[] | null) {
        this.previousProjectData.set(data);
    }

    // Breadcrumb data storage
    public breadcrumbData = signal<BreadcrumbNode[][]>([]);
    getBreadcrumbData = computed(() => this.breadcrumbData());
    setBreadcrumbData(data: BreadcrumbNode[][]) {
        this.breadcrumbData.set(data);
    }

    // Computed getters for URL filtering
    get urlsChecking(): UrlItem[] { return this.validationState().urls.filter(u => u.status === 'checking'); }
    get urlsBlocked(): UrlItem[] { return this.validationState().urls.filter(u => u.status === 'blocked'); }
    get urlsBad(): UrlItem[] { return this.validationState().urls.filter(u => u.status === 'bad'); }
    get urlsRedirected(): UrlItem[] { return this.validationState().urls.filter(u => u.status === 'redirect'); }
    get urlsOk(): UrlItem[] { return this.validationState().urls.filter(u => u.status === 'ok'); }

    // Reset validation state
    resetValidation() {
        this.validationState.set({
            rawUrls: '', //this.validationState().rawUrls, // preserve textarea input
            urls: [],
            urlTotal: 0,
            urlChecked: 0,
            urlPercent: 0,
            isValidating: false,
            isValidated: false,
            isOk: false,
        });
    }

    // Reset breadcrumb state
    resetBreadcrumbs() {
        this.breadcrumbState.set({
            progress: 0,
            currentStep: '',
            isValidating: false,
            isValidated: false,
        });
        this.breadcrumbData.set([]);
    }

    // Reset all state
    resetAll() {
        this.resetValidation();
        this.resetBreadcrumbs();
        this.previousProjectData.set(null);
    }

    // Get complete state snapshot
    getState(): AddPagesState {
        return {
            validation: this.validationState(),
            breadcrumbs: this.breadcrumbState(),
        };
    }
}