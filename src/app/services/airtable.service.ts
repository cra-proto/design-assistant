import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AirtableRecord {
    id: string;
    createdTime: string;
    fields: Record<string, any>;
}

export interface AirtableResponse {
    records: AirtableRecord[];
    offset?: string; // Used for pagination
}

@Injectable({
    providedIn: 'root'
})
export class AirtableService {
    private http = inject(HttpClient);

    private readonly BACKEND_URL = environment.apiUrl;

    // Signals for managing data state
    private records = signal<AirtableRecord[]>([]);
    private loading = signal<boolean>(false);
    private error = signal<string | null>(null);

    // Computed signals
    public isLoading = computed(() => this.loading());
    public hasError = computed(() => !!this.error());
    public errorMessage = computed(() => this.error());
    public data = computed(() => this.records());

    /**
     * Fetch all records from the Airtable table
     */
    async fetchRecords(): Promise<AirtableRecord[]> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const response = await firstValueFrom(
                this.http.get<AirtableResponse>(`${this.BACKEND_URL}/airtable/records`).pipe(
                    catchError(error => {
                        console.error('Failed to fetch Airtable records:', error);
                        this.error.set(error.error?.error || 'Failed to fetch records');
                        return of(null);
                    })
                )
            );

            if (response) {
                this.records.set(response.records);
                console.log(`Fetched ${response.records.length} records from Airtable`);
                return response.records;
            }

            return [];
        } catch (error) {
            console.error('Error fetching Airtable records:', error);
            this.error.set('An unexpected error occurred');
            return [];
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Clear the current records and error state
     */
    clearRecords(): void {
        this.records.set([]);
        this.error.set(null);
    }
}