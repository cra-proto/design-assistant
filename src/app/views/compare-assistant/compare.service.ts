import { Injectable, signal } from '@angular/core';
import { htmlProcessingResult } from '../../services/html-normalization.service';

@Injectable({
    providedIn: 'root'
})
export class CompareService {

    // HTML content cache
    originalHtml = signal<htmlProcessingResult | undefined>(undefined);
    modifiedHtml = signal<htmlProcessingResult | undefined>(undefined);

    // User selections & defaults
    selectedPage = signal('');
    selectedBefore = signal<'live' | 'preview' | 'prototype' | 'baseline' | 'ai'>('live');
    selectedAfter = signal<'live' | 'preview' | 'prototype' | 'baseline' | 'ai'>('prototype');
    selectedView = signal<'original' | 'diff' | 'modified'>('diff');
    loading = signal<boolean>(false);
    loadingBefore = signal<boolean>(false);
    loadingAfter = signal<boolean>(false);

    // Clear HTML content cache
    clearCache() {
        this.originalHtml.set(undefined);
        this.modifiedHtml.set(undefined);
    }

    // Reset to defaults
    resetSelections() {
        this.selectedPage.set('');
        this.selectedBefore.set('live');
        this.selectedAfter.set('prototype');
        this.selectedView.set('diff');
        this.clearCache();
    }
}