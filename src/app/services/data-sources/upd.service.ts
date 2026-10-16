import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';

import { catchError, firstValueFrom, of } from 'rxjs';

export interface UpdPageData {
  url: string;
  title: string;
  status: string;
  visits: number;
}

@Injectable({ providedIn: 'root' })
export class UpdService {
  private readonly http = inject(HttpClient);

  private readonly DATA_URL = '/visits-urls.json';

  // Signals for managing data state
  private readonly pageData = signal<UpdPageData[]>([]);
  private readonly loading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly lastFetched = signal<number | null>(null);

  // Computed signals
  public readonly isLoading = computed(() => this.loading());
  public readonly hasError = computed(() => !!this.error());
  public readonly errorMessage = computed(() => this.error());
  public readonly data = computed(() => this.pageData());
  public readonly isCached = computed(() => this.lastFetched() !== null);

  /**
   * Fetch UPD data from JSON file (or use cached data if available)
   */
  public async fetchData(forceRefresh = false): Promise<UpdPageData[]> {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && this.pageData().length > 0) {
      console.log('Using cached UPD data');
      return this.pageData();
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      console.log('Fetching UPD data...');
      const response = await firstValueFrom(
        this.http.get<UpdPageData[]>(this.DATA_URL).pipe(
          catchError((error) => {
            console.error('Failed to fetch UPD data:', error);
            this.error.set('Failed to fetch visit data');
            return of(null);
          }),
        ),
      );

      if (response) {
        this.pageData.set(response);
        this.lastFetched.set(Date.now());
        console.log(`Fetched ${response.length} pages from UPD data`);
        return response;
      }

      return [];
    } catch (error) {
      console.error('Error fetching UPD data:', error);
      this.error.set('An unexpected error occurred');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Clear cached data and fetch fresh data
   */
  public async refreshData(): Promise<UpdPageData[]> {
    this.clearCache();
    return await this.fetchData(true);
  }

  /**
   * Clear the cache and current data
   */
  private clearCache(): void {
    this.pageData.set([]);
    this.error.set(null);
    this.lastFetched.set(null);
    console.log('Cleared UPD cache');
  }

  /**
   * Find visits for a given URL
   */
  public findVisitsByUrl(url: string): number {
    const page = this.pageData().find((item) => item.url === url);
    return page?.visits ?? -1;
  }

  /**
   * Find complete page data for a given URL
   */
  public findPageDataByUrl(url: string): UpdPageData | undefined {
    return this.pageData().find((item) => item.url === url);
  }

  /**
   * Get top N pages by visits
   */
  public getTopPagesByVisits(limit = 10): UpdPageData[] {
    return [...this.pageData()].sort((a, b) => b.visits - a.visits).slice(0, limit);
  }

  /**
   * Search pages by title or URL
   */
  public searchPages(query: string): UpdPageData[] {
    if (!query.trim()) {
      return this.pageData();
    }

    const lowerQuery = query.toLowerCase();
    return this.pageData().filter((page) => {
      return page.title.toLowerCase().includes(lowerQuery) || page.url.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Get total visits across all pages
   */
  public getTotalVisits(): number {
    return this.pageData().reduce((sum, page) => sum + page.visits, 0);
  }

  /**
   * Check if data is available (cached or needs fetching)
   */
  public hasData(): boolean {
    return this.pageData().length > 0;
  }

  /**
   * Get the timestamp of when data was last fetched
   */
  public getLastFetchedTime(): Date | null {
    const timestamp = this.lastFetched();
    return timestamp ? new Date(timestamp) : null;
  }
}
