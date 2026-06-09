import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MetadataReview } from '../common/data.model';
import { UserSettingsService } from './user-settings.service';

@Injectable({ providedIn: 'root' })
export class UsageService {
    private http = inject(HttpClient);
    private settingsService = inject(UserSettingsService);

    private readonly apiUrl = environment.usageFunctionUrl;

    async trackMetadata(
        projectId: string,
        org: string,
        pageUrl: string,
        originalDescEN: string | undefined,
        originalDescFR: string | undefined,
        originalKeywordsEN: string[] | undefined,
        originalKeywordsFR: string[] | undefined,
        review: MetadataReview,
        promptConfig: object
    ): Promise<void> {
        try {
            await firstValueFrom(
                this.http.post(this.apiUrl, {
                    feature: 'metadata',
                    projectId,
                    org,
                    userId: this.settingsService.userId(),
                    pageUrl,
                    model: review.model,
                    promptConfig,
                    generatedAt: review.generatedAt.toISOString(),
                    originalDescEN,
                    originalDescFR,
                    originalKeywordsEN,
                    originalKeywordsFR,
                    aiDescEN: review.en.description.ai,
                    aiDescFR: review.fr.description.ai,
                    aiKeywordsEN: review.en.keywords.ai,
                    aiKeywordsFR: review.fr.keywords.ai,
                    finalDescEN: review.en.description.edited ?? review.en.description.ai,
                    finalDescFR: review.fr.description.edited ?? review.fr.description.ai,
                    finalKeywordsEN: review.en.keywords.edited ?? review.en.keywords.ai,
                    finalKeywordsFR: review.fr.keywords.edited ?? review.fr.keywords.ai,
                    statusDescEN: review.en.description.status,
                    statusDescFR: review.fr.description.status,
                    statusKeywordsEN: review.en.keywords.status,
                    statusKeywordsFR: review.fr.keywords.status,
                })
            );
        } catch (error) {
            console.warn('Usage tracking failed silently:', error);
        }
    }
}