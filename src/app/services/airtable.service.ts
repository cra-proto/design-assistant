import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TransformedTask {
    id: number;
    taskNameEN: string;
    taskNameFR: string;
    urlsEN: string[];
    urlsFR: string[];
}

@Injectable({
    providedIn: 'root'
})
export class AirtableService {
    private http = inject(HttpClient);

    private readonly FUNCTION_URL = environment.airtableFunctionUrl;
    private readonly CACHE_KEY = 'airtable_task_data';

    // Signals for managing data state
    private tasks = signal<TransformedTask[]>([]);
    private loading = signal<boolean>(false);
    private error = signal<string | null>(null);
    private lastFetched = signal<number | null>(null);

    // Computed signals
    public isLoading = computed(() => this.loading());
    public hasError = computed(() => !!this.error());
    public errorMessage = computed(() => this.error());
    public data = computed(() => this.tasks());
    public isCached = computed(() => this.lastFetched() !== null);

    constructor() {
        // Load cached data from session storage on initialization
        this.loadFromCache();

        // Effect to persist data to session storage whenever it changes
        effect(() => {
            const data = this.tasks();
            if (data.length > 0) {
                this.saveToCache(data);
            }
        });
    }

    /**
     * Fetch task data from Airtable (or use cached data if available)
     */
    async fetchTasks(forceRefresh = false): Promise<TransformedTask[]> {
        // Return cached data if available and not forcing refresh
        if (!forceRefresh && this.tasks().length > 0) {
            console.log('Returning cached Airtable data');
            return this.tasks();
        }

        this.loading.set(true);
        this.error.set(null);

        try {
            console.log('Fetching fresh data from Airtable Lambda...');
            const response = await firstValueFrom(
                this.http.get<TransformedTask[]>(this.FUNCTION_URL).pipe(
                    catchError(error => {
                        console.error('Failed to fetch Airtable tasks:', error);
                        this.error.set(error.error?.error || 'Failed to fetch tasks');
                        return of(null);
                    })
                )
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
     * Load data from session storage cache
     */
    private loadFromCache(): void {
        try {
            const cached = sessionStorage.getItem(this.CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached) as TransformedTask[];
                this.tasks.set(data);
                this.lastFetched.set(Date.now());
                console.log(`Loaded ${data.length} tasks from session storage cache`);
            }
        } catch (error) {
            console.error('Error loading from cache:', error);
            sessionStorage.removeItem(this.CACHE_KEY);
        }
    }

    /**
     * Save data to session storage cache
     */
    private saveToCache(data: TransformedTask[]): void {
        try {
            sessionStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
            console.log(`Saved ${data.length} tasks to session storage cache`);
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    /**
     * Clear cached data and fetch fresh data
     */
    async refreshData(): Promise<TransformedTask[]> {
        this.clearCache();
        return this.fetchTasks(true);
    }

    /**
     * Clear the cache and current data
     */
    clearCache(): void {
        this.tasks.set([]);
        this.error.set(null);
        this.lastFetched.set(null);
        sessionStorage.removeItem(this.CACHE_KEY);
        console.log('Cleared Airtable cache');
    }

    /**
     * Get tasks filtered by language
     */
    getTasksByLanguage(language: 'en' | 'fr'): TransformedTask[] {
        return this.tasks().filter(task => {
            const urls = language === 'en' ? task.urlsEN : task.urlsFR;
            return urls.length > 0;
        });
    }

    /**
     * Search tasks by name
     */
    searchTasks(query: string, language: 'en' | 'fr' = 'en'): TransformedTask[] {
        if (!query.trim()) {
            return this.tasks();
        }

        const lowerQuery = query.toLowerCase();
        return this.tasks().filter(task => {
            const taskName = language === 'en' ? task.taskNameEN : task.taskNameFR;
            return taskName.toLowerCase().includes(lowerQuery);
        });
    }
}