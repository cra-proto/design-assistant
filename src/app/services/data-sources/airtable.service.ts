import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';

import { catchError, firstValueFrom, of } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TransformedTask {
  id: number;
  taskNameEN: string;
  taskNameFR: string;
  urlsEN: string[];
  urlsFR: string[];
}

@Injectable({ providedIn: 'root' })
export class AirtableService {
  private readonly http = inject(HttpClient);

  private readonly FUNCTION_URL = environment.airtableFunctionUrl;

  // Signals for managing data state
  private readonly tasks = signal<TransformedTask[]>([]);
  private readonly loading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);
  private readonly lastFetched = signal<number | null>(null);

  // Computed signals
  public readonly isLoading = computed(() => this.loading());
  public readonly hasError = computed(() => !!this.error());
  public readonly errorMessage = computed(() => this.error());
  public readonly data = computed(() => this.tasks());
  public readonly isCached = computed(() => this.lastFetched() !== null);

  /**
   * Fetch task data from Airtable (or use cached data if available)
   */
  public async fetchTasks(forceRefresh = false): Promise<TransformedTask[]> {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh && this.tasks().length > 0) {
      console.log('Using cached Airtable data');
      return this.tasks();
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      console.log('Fetching Airtable data...');
      const response = await firstValueFrom(
        this.http.get<TransformedTask[]>(this.FUNCTION_URL).pipe(
          catchError((error) => {
            console.error('Failed to fetch Airtable tasks:', error);
            this.error.set(error.error?.error || 'Failed to fetch tasks');
            return of(null);
          }),
        ),
      );

      if (response) {
        this.tasks.set(response);
        this.lastFetched.set(Date.now());
        console.log(`Fetched ${response.length} tasks from Airtable`);
        return response;
      }

      return [];
    } catch (error) {
      console.error('Error fetching Airtable tasks:', error);
      this.error.set('An unexpected error occurred');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Clear cached data and fetch fresh data
   */
  public async refreshData(): Promise<TransformedTask[]> {
    this.clearCache();
    return await this.fetchTasks(true);
  }

  /**
   * Clear the cache and current data
   */
  private clearCache(): void {
    this.tasks.set([]);
    this.error.set(null);
    this.lastFetched.set(null);
    console.log('Cleared Airtable cache');
  }

  /**
   * Get tasks filtered by language
   */
  public getTasksByLanguage(language: 'en' | 'fr'): TransformedTask[] {
    return this.tasks().filter((task) => {
      const urls = language === 'en' ? task.urlsEN : task.urlsFR;
      return urls.length > 0;
    });
  }

  /**
   * Search tasks by name
   */
  public searchTasks(query: string, language: 'en' | 'fr' = 'en'): TransformedTask[] {
    if (!query.trim()) {
      return this.tasks();
    }

    const lowerQuery = query.toLowerCase();
    return this.tasks().filter((task) => {
      const taskName = language === 'en' ? task.taskNameEN : task.taskNameFR;
      return taskName.toLowerCase().includes(lowerQuery);
    });
  }

  // Finds all tasks for a given URL
  public findTaskNamesByUrl(url: string, language: 'en' | 'fr'): string[] {
    const matchingTasks = this.tasks().filter((task) => {
      const urls = language === 'en' ? task.urlsEN : task.urlsFR;
      return urls.some((taskUrl) => taskUrl === url);
    });

    return matchingTasks.map((task) => (language === 'en' ? task.taskNameEN : task.taskNameFR));
  }

  /**
   * Check if data is available (cached or needs fetching)
   */
  public hasData(): boolean {
    return this.tasks().length > 0;
  }

  /**
   * Get the timestamp of when data was last fetched
   */
  public getLastFetchedTime(): Date | null {
    const timestamp = this.lastFetched();
    return timestamp ? new Date(timestamp) : null;
  }
}
