import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';
import { UrlItem } from '../add-pages.model';

@Injectable({
    providedIn: 'root'
})
export class UrlValidationService {
    private fetchService = inject(FetchService);

    //Parse raw URL input into UrlItem array
    parseUrls(rawUrls: string, existingUrls: Set<string>, currentLang: 'en' | 'fr'): { parsedUrls: UrlItem[]; duplicates: string[]; invalidUrls: string[]; oppositeLangUrls: string[]; } {
        const seen = new Set<string>(existingUrls); //to track duplicates
        const duplicates: string[] = []; //to store duplicates
        const invalidUrls: string[] = []; //to store invalid urls
        const oppositeLangUrls: string[] = []; //to store opposite language urls

        // Step 1: Normalize URLs and detect their languages
        const normalizedUrls = rawUrls
            .split(/\r?\n/)
            .map(line => line.trim().toLowerCase())
            .filter(Boolean)
            .map(line => ({
                original: line,
                normalized: this.normalizeUrl(line),
                lang: this.detectUrlLanguage(this.normalizeUrl(line))
            }));

        // Step 2: Determine project language
        const projectLang = this.detectProjectLanguage(existingUrls, normalizedUrls, currentLang);

        // Step 3: Filter and validate
        const parsedUrls = normalizedUrls
            .filter(({ normalized, lang, original }) => {
                // Check if it's a valid URL with language
                if (!lang || !normalized.includes('canada.ca')) {
                    invalidUrls.push(original);
                    return false;
                }
                // Check if language matches project language
                if (lang !== projectLang) {
                    oppositeLangUrls.push(normalized);
                    return false;
                }
                // Check for duplicates
                if (seen.has(normalized)) {
                    duplicates.push(normalized);
                    return false;
                }
                seen.add(normalized);
                return true;
            })
            .map(({ normalized }) => ({ href: normalized, status: 'checking' as const }));
        return { parsedUrls, duplicates, invalidUrls, oppositeLangUrls };
    }

    // Normalize incomplete URLs
    private normalizeUrl(input: string): string {
        let url = input;

        // Fix domain
        if (url.match('/content/canadasite')) {
            url = url.replace('/content/canadasite', '');
        }
        if (!url.startsWith('http')) {
            if (url.startsWith('/en') || url.startsWith('/fr')) {
                url = 'https://www.canada.ca' + url;
            } else if (url.startsWith('en') || url.startsWith('fr')) {
                url = 'https://www.canada.ca/' + url;
            } else if (url.startsWith('www')) {
                url = 'https://' + url;
            } else if (url.startsWith('canada.ca')) {
                url = 'https://www.' + url;
            }
        }
        else if (url.startsWith('https://canada-preview.adobecqms.net')) {
            url = url.replace('https://canada-preview.adobecqms.net', 'https://www.canada.ca');
        }

        // Fix extension
        if (!url.endsWith('.html') && !url.endsWith('/')) {
            if (url.endsWith('/en') || url.endsWith('/fr')) {
                url = url + '.html';
            }
            if ((url.includes('/en/') || url.includes('/fr/')) && !url.match(/\.[a-z]{2,4}$/i)) {
                url = url + '.html';
            }
        }

        return url;
    }

    // Detect url language
    private detectUrlLanguage(url: string): 'en' | 'fr' | null {
        if (url.includes('/en/') || url.endsWith('/en.html')) {
            return 'en';
        }
        if (url.includes('/fr/') || url.endsWith('/fr.html')) {
            return 'fr';
        }
        return null;
    }

    // Detect project language
    private detectProjectLanguage(
        existingUrls: Set<string>,
        normalizedUrls: { normalized: string; lang: 'en' | 'fr' | null }[],
        currentLang: 'en' | 'fr'
    ): 'en' | 'fr' {
        // Priority 1: If project has existing URLs, use their language
        if (existingUrls.size > 0) {
            const firstUrl = Array.from(existingUrls)[0];
            const existingLang = this.detectUrlLanguage(firstUrl);
            if (existingLang) return existingLang;
        }

        // Priority 2: If pasted URLs are all one language, use that
        const pastedLanguages = normalizedUrls
            .map(u => u.lang)
            .filter((lang): lang is 'en' | 'fr' => lang !== null);

        if (pastedLanguages.length > 0) {
            const uniqueLangs = new Set(pastedLanguages);

            if (uniqueLangs.size === 1) {
                return pastedLanguages[0];
            }
        }

        // Priority 3: If no project language and pasted urls are mixed, fallback to app language
        return currentLang;
    }

    // Validate a single URL
    async validateUrl(link: UrlItem): Promise<void> {
        try {
            const response = await this.fetchService.fetchStatus(link.href, "prod", 3, "random", 1000);

            if (!response.ok || response.url.includes('404.html')) {
                link.status = 'bad';
            } else if (response.url !== link.href) {
                link.status = 'redirect';
                link.originalHref = link.href;
                link.href = response.url;
            } else {
                link.status = 'ok';
            }
        } catch (error) {
            console.error(error);
            if ((error as Error).message.startsWith("Blocked host")) {
                link.status = "blocked";
            } else {
                link.status = "bad";
            }
        }
    }

    // Validate multiple URLs sequentially (concurrency can cause issues with Akamai rate limiting)
    async validateUrls(urls: UrlItem[], onProgress?: (checked: number, total: number) => void): Promise<void> {
        let checked = 0;
        const total = urls.length;

        for (const url of urls) {
            await this.validateUrl(url);
            checked++;
            onProgress?.(checked, total);
        }
    }
}