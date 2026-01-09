import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

export interface TaskUrl {
    id: number;
    taskNameEN: string;
    taskNameFR: string;
    urlsEN: string[];
    urlsFR: string[];
}

export interface TaskOption {
    id: number;
    label: string;
    value: string;
    urlCount: number;
}

@Injectable({
    providedIn: 'root'
})
export class TaskService {
    private readonly DATA_URL = '/task-urls.json';
    private http = inject(HttpClient);
    private translate = inject(TranslateService);

    // Track current language as a signal
    private currentLangSignal = signal<string>(this.translate.currentLang || 'en');

    // Loading state
    private loadingSignal = signal<boolean>(false);
    private errorSignal = signal<string | null>(null);

    // Raw data from HTTP request
    private dataSignal = signal<TaskUrl[] | null>(null);

    constructor() {
        // Subscribe to language changes and update signal
        this.translate.onLangChange.subscribe(event => {
            console.log('Language changed to:', event.lang);
            this.currentLangSignal.set(event.lang);
        });
    }

    // Public signals
    readonly loading = this.loadingSignal.asReadonly();
    readonly error = this.errorSignal.asReadonly();
    readonly tasks = this.dataSignal.asReadonly();

    /**
     * Computed signals for current language keys
     */
    private readonly taskNameKey = computed((): 'taskNameEN' | 'taskNameFR' => {
        const lang = this.currentLangSignal(); // Now this triggers reactivity!
        return lang === 'fr' ? 'taskNameFR' : 'taskNameEN';
    });

    private readonly urlsKey = computed((): 'urlsEN' | 'urlsFR' => {
        const lang = this.currentLangSignal(); // Now this triggers reactivity!
        return lang === 'fr' ? 'urlsFR' : 'urlsEN';
    });

    /**
     * Computed signal for task options (language-aware for autocomplete)
     */
    readonly taskOptions = computed((): TaskOption[] => {
        const tasks = this.tasks();
        if (!tasks) return [];

        const taskKey = this.taskNameKey();
        const urlKey = this.urlsKey();

        return tasks.map(task => ({
            id: task.id,
            label: task[taskKey],
            value: task[taskKey],
            urlCount: task[urlKey].length
        }));
    });

    /**
     * Load task data from JSON file
     * Call this from your component's ngOnInit
     */
    loadTasks(): void {
        if (this.dataSignal()) {
            // Already loaded, don't reload
            return;
        }

        this.loadingSignal.set(true);
        this.errorSignal.set(null);

        this.http.get<TaskUrl[]>(this.DATA_URL)
            .pipe(
                catchError(err => {
                    this.errorSignal.set('Failed to load task data');
                    console.error('Error loading task data:', err);
                    return of(null);
                })
            )
            .subscribe(data => {
                this.dataSignal.set(data);
                this.loadingSignal.set(false);
            });
    }

    /**
     * Get URLs for a specific task (by name or ID, language-aware)
     */
    getTaskUrls(taskIdentifier: string | number): string[] {
        const tasks = this.tasks();
        if (!tasks) return [];

        let task: TaskUrl | undefined;

        if (typeof taskIdentifier === 'number') {
            // Find by ID
            task = tasks.find(t => t.id === taskIdentifier);
        } else {
            // Find by name (check both EN and FR)
            task = tasks.find(t =>
                t.taskNameEN === taskIdentifier || t.taskNameFR === taskIdentifier
            );
        }

        if (!task) return [];

        // Return URLs in current language using computed key
        const urlKey = this.urlsKey();
        return task[urlKey];
    }

    /**
     * Get task data by ID
     */
    getTaskById(id: number): TaskUrl | undefined {
        const tasks = this.tasks();
        if (!tasks) return undefined;
        return tasks.find(task => task.id === id);
    }

    /**
     * Search tasks by name (case-insensitive, language-aware)
     */
    searchTasks(query: string): TaskOption[] {
        const tasks = this.tasks();
        if (!tasks || !query) return [];

        const lowerQuery = query.toLowerCase();
        const taskKey = this.taskNameKey();
        const urlKey = this.urlsKey();

        return tasks
            .filter(task => {
                return task[taskKey].toLowerCase().includes(lowerQuery);
            })
            .map(task => ({
                id: task.id,
                label: task[taskKey],
                value: task[taskKey],
                urlCount: task[urlKey].length
            }));
    }

    /**
     * Get all unique URLs in current language
     */
    readonly allUrls = computed(() => {
        const tasks = this.tasks();
        if (!tasks) return [];

        const urlKey = this.urlsKey();
        const urls = new Set<string>();

        tasks.forEach(task => {
            task[urlKey].forEach(url => urls.add(url));
        });

        return Array.from(urls);
    });
}