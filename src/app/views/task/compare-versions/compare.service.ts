import { Injectable, signal } from '@angular/core';
import { htmlProcessingResult } from '../../../services/html-normalization.service';

export const COMPARE_VERSIONS = ['live', 'preview', 'protoGH', 'baseGH', 'protoUT', 'baseUT', 'ai'] as const
export type CompareVersion = typeof COMPARE_VERSIONS[number];

@Injectable({
    providedIn: 'root'
})
export class CompareService {

    // HTML content cache
    private htmlCache = signal<Map<string, htmlProcessingResult>>(new Map());
    private statusCache = signal<Map<string, boolean>>(new Map());
    originalHtml = signal<htmlProcessingResult | undefined>(undefined);
    modifiedHtml = signal<htmlProcessingResult | undefined>(undefined);

    // User selections & defaults
    selectedPage = signal('');
    selectedBefore = signal<CompareVersion>('live');
    selectedAfter = signal<CompareVersion>('protoGH');
    selectedView = signal<'original' | 'diff' | 'modified'>('diff');
    loading = signal<boolean>(false);
    loadingBefore = signal<boolean>(false);
    loadingAfter = signal<boolean>(false);
    loadingAll = signal<boolean>(false);
    includePreview = signal<boolean>(false);

    // Helpers to get & set HTML cache
    getCachedHtml(url: string): htmlProcessingResult | undefined {
        return this.htmlCache().get(url);
    }

    setCachedHtml(url: string, html: htmlProcessingResult): void {
        const cache = new Map(this.htmlCache());
        cache.set(url, html);
        this.htmlCache.set(cache);
    }

    // Helpers to get & set status cache
    getCachedStatus(url: string): boolean | undefined {
        return this.statusCache().get(url);
    }

    setCachedStatus(url: string, status: boolean): void {
        const cache = new Map(this.statusCache());
        cache.set(url, status);
        this.statusCache.set(cache);
        console.log('Cached status:', url, status);
    }

    // Clear HTML content cache
    clearCache() {
        this.htmlCache.set(new Map());
        this.statusCache.set(new Map());
        this.originalHtml.set(undefined);
        this.modifiedHtml.set(undefined);
    }

    // Reset to defaults
    resetSelections() {
        this.selectedPage.set('');
        this.selectedBefore.set('live');
        this.selectedAfter.set('protoGH');
        this.selectedView.set('diff');
        this.clearCache();
    }
}