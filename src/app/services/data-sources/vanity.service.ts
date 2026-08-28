import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';

import { catchError, firstValueFrom, of } from 'rxjs';

export interface VanityEntry {
  destination: string;
  vanity: string[];
}

@Injectable({ providedIn: 'root' })
export class VanityService {
  private readonly http = inject(HttpClient);
  private readonly DATA_URL = '/vanity-urls.json';

  private readonly vanityData = signal<VanityEntry[]>([]);
  private readonly loading = signal<boolean>(false);
  private readonly error = signal<string | null>(null);

  public readonly isLoading = computed(() => this.loading());
  public readonly hasError = computed(() => !!this.error());

  public async fetchData(forceRefresh = false): Promise<void> {
    if (!forceRefresh && this.vanityData().length > 0) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.get<VanityEntry[]>(this.DATA_URL).pipe(
          catchError((error) => {
            console.error('Failed to fetch vanity data:', error);
            this.error.set('Failed to fetch vanity URLs');
            return of(null);
          }),
        ),
      );
      if (response) this.vanityData.set(response);
    } catch (error) {
      console.error('Error fetching vanity data:', error);
      this.error.set('An unexpected error occurred');
    } finally {
      this.loading.set(false);
    }
  }

  public findVanitiesByDestination(destination: string): string[] {
    return this.vanityData().find((entry) => entry.destination === destination)?.vanity ?? [];
  }
}
