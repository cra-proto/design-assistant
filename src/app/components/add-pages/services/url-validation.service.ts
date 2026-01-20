import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';
import { UrlItem } from '../add-pages.model';

@Injectable({
    providedIn: 'root'
})
export class UrlValidationService {
    private fetchService = inject(FetchService);

    //Parse raw URL input into UrlItem array
    parseUrls(rawUrls: string, existingUrls: Set<string>): { parsedUrls: UrlItem[]; duplicates: string[]; } {
        const seen = new Set<string>(existingUrls); //to track duplicates
        const duplicates: string[] = []; //to store duplicates
        const parsedUrls = rawUrls
            .split(/\r?\n/) //split by new lines
            .map(line => line.trim().toLowerCase()) //normalize
            .filter(Boolean) //remove empty lines
            .filter(href => { //remove duplicates
                if (seen.has(href)) {
                    duplicates.push(href)
                    return false;
                }
                seen.add(href);
                return true;
            })
            .map(href => ({ href, status: 'checking' as const })); //create UrlItem
        return { parsedUrls, duplicates };
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