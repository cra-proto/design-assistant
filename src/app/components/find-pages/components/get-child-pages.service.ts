import { Injectable, inject, signal, computed } from '@angular/core';
import { TreeNode } from 'primeng/api';

import { ProjectStateService } from '../../../services/project-state.service';
import { FetchService } from '../../../services/fetch.service';
import { BreadcrumbNode } from '../../add-pages/add-pages.model';
import { AddPagesStateService } from '../../add-pages/services/add-pages-state.service';

interface PageToAdd {
    url: string;
    depthFromInScope: number;
}

interface CachedPage {
    url: string;
    breadcrumbs: BreadcrumbNode[];
}

interface SearchProgress {
    depth: number;
    processedUrls: number;
    totalUrls: number;
}

@Injectable({
    providedIn: 'root'
})
export class GetChildPagesService {
    private projectState = inject(ProjectStateService);
    private addPagesState = inject(AddPagesStateService);
    private fetchService = inject(FetchService);

    //Variables
    public depth = 0;

    //Progress tracking
    searchProgress = signal<SearchProgress | null>(null);

    //Pages to skip children when building IA chart
    private readonly skipFormsAndPubs = new Set<string>([
        'https://www.canada.ca/en/revenue-agency/services/forms-publications/forms.html',
        'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/formulaires.html',
        'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications.html',
        'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications.html',
    ]);

    async findChildren(startingLinks: Set<string>, depth: number): Promise<string[]> {
        if (depth < 1) return [];

        // Arrays
        const addToProject: PageToAdd[] = [];
        const linkCache: CachedPage[] = [];

        // Step 1: Fetch all links from starting page(s) (in-scope URLs or a specific url)
        this.searchProgress.set({ depth: 0, processedUrls: 0, totalUrls: startingLinks.size, });
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to allow UI updates
        const allLinks: string[] = [];
        for (const url of startingLinks) {
            try {
                const doc = await this.fetchService.fetchContent(url, "prod", 3, 50, false);
                const links = this.fetchService.getLinks(doc, url);
                allLinks.push(...links);
            } catch (error) {
                console.warn(`Failed to fetch project URL ${url}: ${error}`);
            }
            this.searchProgress.update(progress => ({
                ...progress!,
                processedUrls: progress!.processedUrls + 1
            }));
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between fetches
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Large delay to allow UI updates
        let currentDepthUrls = [...new Set(allLinks)];

        console.log(currentDepthUrls);

        //Step 2: Process each depth level
        for (let currentDepth = 1; currentDepth <= depth; currentDepth++) {
            const nextDepthUrls: string[] = [];
            this.searchProgress.set({ depth: currentDepth, processedUrls: 0, totalUrls: currentDepthUrls.length, });
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to allow UI updates

            for (const url of currentDepthUrls) {
                try {
                    const { doc, finalUrl } = await this.fetchService.fetchContentAndStatus(url, "prod", 3, 50, false);
                    const breadcrumbs = this.fetchService.getBreadcrumb(doc, finalUrl);
                    const links = this.fetchService.getLinks(doc, finalUrl);

                    let foundAncestor = false;

                    // Check if page is a descendant of any in-scope URL within the specified depth
                    for (let i = 1; i <= depth && i <= breadcrumbs.length; i++) {
                        const checkPosition = breadcrumbs.length - i;
                        if (startingLinks.has(breadcrumbs[checkPosition].url)) {
                            addToProject.push({ url: finalUrl, depthFromInScope: i });
                            foundAncestor = true;
                            if (i < depth) { nextDepthUrls.push(...links); }
                            break;
                        }
                    }
                    if (foundAncestor) continue;

                    // Check if page is a descendant of any already-added pages
                    for (const parent of addToProject) {
                        const maxDistanceFromParent = depth - parent.depthFromInScope;

                        for (let i = 1; i <= maxDistanceFromParent && i <= breadcrumbs.length; i++) {
                            const checkPosition = breadcrumbs.length - i;
                            if (checkPosition >= 0 && breadcrumbs[checkPosition].url === parent.url) {
                                const pageDepth = parent.depthFromInScope + i;
                                addToProject.push({ url: finalUrl, depthFromInScope: pageDepth });
                                foundAncestor = true;

                                if (pageDepth < depth) { nextDepthUrls.push(...links); }
                                break;
                            }
                        }
                        if (foundAncestor) break; // Exit parent loop if we found a match
                    }

                    if (!foundAncestor) { linkCache.push({ url, breadcrumbs }); }
                } catch (error) {
                    console.warn(`Skipping ${url}: ${error}`);
                } finally {
                    this.searchProgress.update(progress => ({
                        ...progress!,
                        processedUrls: progress!.processedUrls + 1
                    }));
                    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between fetches
                }
            }
            currentDepthUrls = [...new Set(nextDepthUrls)].filter(link =>
                !startingLinks.has(link) &&
                !addToProject.some(p => p.url === link) &&
                !linkCache.some(p => p.url === link)
            );
            await new Promise(resolve => setTimeout(resolve, 1000)); // Large delay to allow UI updates
        }

        //Step 3: Recheck link cache for any matches after processing all depths
        for (const cached of linkCache) {
            for (const parent of addToProject) {
                const maxDistanceFromParent = depth - parent.depthFromInScope;
                let foundAncestor = false;

                for (let i = 1; i <= maxDistanceFromParent && i <= cached.breadcrumbs.length; i++) {
                    const checkPosition = cached.breadcrumbs.length - i;
                    if (checkPosition >= 0 && cached.breadcrumbs[checkPosition].url === parent.url) {
                        const pageDepth = parent.depthFromInScope + i;
                        addToProject.push({ url: cached.url, depthFromInScope: pageDepth });
                        foundAncestor = true;
                        break;
                    }
                }
                if (foundAncestor) break;
            }
        }
        //Step 4: Return results so calling function can determine next step
        this.searchProgress.set(null);
        return [...new Set(addToProject.map(p => p.url))];
    }

}