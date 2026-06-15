import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';

//PrimeNG Components
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { SelectModule } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectItem } from 'primeng/api';

//Services
import { environment } from '../../../../../../environments/environment';
import { UserSettingsService } from '../../../../../services/user-settings.service';

//TODO: Add option to filter by user

interface UsageStats {
    uniqueUsersTotal: number;
    uniqueUsersGitHub: number;
    uniqueUsersAnonymous: number;

    totalGenerations: number;
    metadataGenerations: number;
    pageGenerations: number;

    uniqueProjects: number;
    localProjects: number;
    cloudProjects: number;

    uniqueUrls: number;
    enUrls: number;
    frUrls: number;

    exportCount: number;
    enPageCount: number;
    frPageCount: number;

    uniqueRepos: number;
    prototypeRepos: number;
    baselineRepos: number;

    uniqueOrgCount: number;
}

interface UsageRecord {
    pk: string;
    sk: string;
    feature: string;
    projectId: string;
    org: string;
    userId: string;
    pageUrl: string;
    model: string;
    promptType?: string;
    promptVersion: number;
    generatedAt: string;
    statusDescEN: string;
    statusDescFR: string;
    statusKeywordsEN: string;
    statusKeywordsFR: string;
    lastUpdated: string;
}

interface DonutFilter {
    field: string;
    model: string;
    promptVersion: string;
    userId: string;
}

const STATUS_FIELDS: Record<string, string[]> = {
    metadata: ['statusDescEN', 'statusDescFR', 'statusKeywordsEN', 'statusKeywordsFR'],
    // page: ['statusAccepted', 'statusRejected'],     // update when ready
    // problems: ['statusAccepted', 'statusRejected'], // update when ready
};

@Component({
    selector: 'aida-usage-monitoring',
    imports: [
        CommonModule, FormsModule, TranslateModule, RouterLink,
        BreadcrumbModule, SkeletonModule, DividerModule, ButtonModule, SelectButtonModule, ToggleButtonModule, SelectModule, IftaLabelModule,
        ChartModule,
    ],
    templateUrl: 'usage-monitoring.component.html',
})
export class UsageMonitoringComponent implements OnInit {
    private translate = inject(TranslateService);
    private http = inject(HttpClient);
    private settingsService = inject(UserSettingsService);
    currentLang = this.settingsService.currentLang;

    // Breadcrumbs
    breadcrumbs = [{ label: 'dev._title', route: '/dev' }, { label: 'dev.monitoring._title' }]

    // Global stats (always loaded)
    stats = signal<UsageStats | null>(null);
    loading = signal(true);
    error = signal<string | null>(null);

    // Feature stats (loaded per feature)
    featureItems = signal<UsageRecord[]>([]);
    featureItemsLoading = signal(false);
    featureItemsError = signal<string | null>(null);

    // Button to switch features
    selectedFeature = signal<string>('metadata');

    featureOptions = computed<SelectItem[]>(() => {
        this.currentLang();
        return [
            { label: this.translate.instant('dev.monitoring.metadata'), value: 'metadata' },
            { label: this.translate.instant('dev.monitoring.page'), value: 'page' },
            // { label: this.translate.instant('dev.monitoring.problems'), value: 'problems' },
        ];
    });

    selectedFeatureLabel = computed(() => {
        const label = this.featureOptions().find(f => f.value === this.selectedFeature())?.label ?? this.selectedFeature();
        return this.currentLang() === 'en'
            ? label.charAt(0).toUpperCase() + label.slice(1)
            : label.toLowerCase();
    });

    // Button to toggle view (single & A/B)
    compareMode = signal<boolean>(false);

    // Filter state for each donut — TODO: default to meaningful comparison
    filterA = signal<DonutFilter>({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
    filterB = signal<DonutFilter>({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });


    updateFilterA(key: keyof DonutFilter, value: string) {
        this.filterA.update(f => ({ ...f, [key]: value }));
    }

    updateFilterB(key: keyof DonutFilter, value: string) {
        this.filterB.update(f => ({ ...f, [key]: value }));
    }

    onFeatureChange(feature: string) {
        this.selectedFeature.set(feature);
        this.filterA.set({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
        this.filterB.set({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
        this.loadFeature(feature);
    }

    // Chart options
    chartDataA = computed(() => this.buildChartData(this.filterA()));
    chartDataB = computed(() => this.buildChartData(this.filterB()));

    chartOptions = {
        cutout: '65%',
        plugins: {
            legend: { display: false }
        }
    };

    // Filter - Field or prompt type options
    fieldOptions = computed<SelectItem[]>(() => {
        this.currentLang();
        if (this.selectedFeature() === 'metadata') {
            return [
                { label: this.translate.instant('dev.monitoring.metadata.allFields'), value: 'all' },
                { label: this.translate.instant('dev.monitoring.metadata.EnDesc'), value: 'statusDescEN' },
                { label: this.translate.instant('dev.monitoring.metadata.FrDesc'), value: 'statusDescFR' },
                { label: this.translate.instant('dev.monitoring.metadata.EnKeywords'), value: 'statusKeywordsEN' },
                { label: this.translate.instant('dev.monitoring.metadata.FrKeywords'), value: 'statusKeywordsFR' },
            ];
        }
        const types = [...new Set(this.featureItems().map(i => i.promptType).filter(Boolean))] as string[];
        return [
            { label: this.translate.instant('dev.monitoring.filter.allPromptTypes'), value: 'all' },
            ...types.map(t => ({ label: t, value: t }))
        ];
    });

    // Filter - AI model options
    modelOptions = computed<SelectItem[]>(() => {
        this.currentLang();
        const models = [...new Set(this.featureItems().map(i => i.model).filter(Boolean))];
        return [
            { label: this.translate.instant('dev.monitoring.filter.allModels'), value: 'all' },
            ...models.map(m => ({ label: m, value: m }))
        ];
    });

    // Filter - prompt version options
    promptOptions = computed<SelectItem[]>(() => {
        this.currentLang();
        const versions = [...new Set(this.featureItems().map(i => `v${i.promptVersion}`).filter(Boolean))];
        return [
            { label: this.translate.instant('dev.monitoring.filter.allVersions'), value: 'all' },
            ...versions.map(v => ({ label: `${this.translate.instant('dev.monitoring.filter.prompt')} ${v}`, value: v }))
        ];
    });

    // Filter - userId options
    userOptions = computed<SelectItem[]>(() => {
        this.currentLang();
        const users = [...new Set(this.featureItems().map(i => i.userId).filter(Boolean))];
        return [
            { label: this.translate.instant('dev.monitoring.filter.allUsers'), value: 'all' },
            ...users.map(m => ({ label: m, value: m }))
        ];
    });

    // Build the chart
    private buildChartData(filter: DonutFilter) {
        const items = this.featureItems();
        const isMetadata = this.selectedFeature() === 'metadata';

        const filtered = items.filter(item => {
            if (filter.model !== 'all' && item.model !== filter.model) return false;
            if (filter.promptVersion !== 'all' && `v${item.promptVersion}` !== filter.promptVersion) return false;
            // For page/problems: filter by promptType using the field filter
            if (!isMetadata && filter.field !== 'all' && item.promptType !== filter.field) return false;
            return true;
        });

        const statusFields = isMetadata
            ? (filter.field === 'all' ? STATUS_FIELDS['metadata'] : [filter.field])
            : STATUS_FIELDS[this.selectedFeature()] ?? [];

        const counts: Record<string, number> = {};
        for (const item of filtered) {
            for (const field of statusFields) {
                const status = (item as any)[field];
                if (status) counts[status] = (counts[status] ?? 0) + 1;
            }
        }

        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        return {
            labels: entries.map(([k]) => this.statusConfig()[k]?.label ?? k),
            datasets: [{
                data: entries.map(([, v]) => v),
                backgroundColor: entries.map(([k]) => this.statusConfig()[k]?.color ?? '#94a3b8'),
                hoverBackgroundColor: entries.map(([k]) => this.statusConfig()[k]?.hoverColor ?? '#64748b'),
            }],
            legendItems: entries.map(([k, v]) => ({
                label: this.statusConfig()[k]?.label ?? k,
                color: this.statusConfig()[k]?.color ?? '#94a3b8',
                count: v
            }))
        };
    }

    // Status's for legend
    statusConfig = computed<Record<string, { label: string; color: string; hoverColor: string }>>(() => {
        this.currentLang();
        return {
            approvedAI: { label: this.translate.instant('dev.monitoring.status.approvedAI'), ...this.statusColours['approvedAI'] },
            approvedEdits: { label: this.translate.instant('dev.monitoring.status.approvedEdits'), ...this.statusColours['approvedEdits'] },
            edited: { label: this.translate.instant('dev.monitoring.status.edited'), ...this.statusColours['edited'] },
            pending: { label: this.translate.instant('dev.monitoring.status.pending'), ...this.statusColours['pending'] },
            rejected: { label: this.translate.instant('dev.monitoring.status.rejected'), ...this.statusColours['rejected'] },
            noChange: { label: this.translate.instant('dev.monitoring.status.noChange'), ...this.statusColours['noChange'] },
        };
    });
    //Fallback colors (will be replaced onInit)
    private statusColours: Record<string, { color: string; hoverColor: string }> = {
        approvedAI: { color: '#4ade80', hoverColor: '#22c55e' },
        approvedEdits: { color: '#60a5fa', hoverColor: '#3b82f6' },
        edited: { color: '#22d3ee', hoverColor: '#06b6d4' },
        pending: { color: '#e2e8f0', hoverColor: '#cbd5e1' },
        rejected: { color: '#f87171', hoverColor: '#ef4444' },
        noChange: { color: '#e2e8f0', hoverColor: '#cbd5e1' },
    };
    private getColour(variable: string): string {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    }

    async ngOnInit() {
        this.statusColours = {
            approvedAI: { color: this.getColour('--p-green-400'), hoverColor: this.getColour('--p-green-500') },
            approvedEdits: { color: this.getColour('--p-blue-400'), hoverColor: this.getColour('--p-blue-500') },
            edited: { color: this.getColour('--p-cyan-400'), hoverColor: this.getColour('--p-cyan-500') },
            pending: { color: this.getColour('--p-surface-200'), hoverColor: this.getColour('--p-surface-300') },
            rejected: { color: this.getColour('--p-red-400'), hoverColor: this.getColour('--p-red-500') },
            noChange: { color: this.getColour('--p-slate-200'), hoverColor: this.getColour('--p-slate-300') },
        };
        await this.load();
    }

    // Load global stats + default feature items
    async load() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const [statsResult, itemsResult] = await Promise.all([
                firstValueFrom(this.http.get<UsageStats>(environment.usageFunctionUrl)),
                firstValueFrom(this.http.get<{ items: UsageRecord[] }>(`${environment.usageFunctionUrl}?feature=${this.selectedFeature()}`))
            ]);
            this.stats.set(statsResult);
            this.featureItems.set(itemsResult.items);
        } catch (err: any) {
            this.error.set(err?.message ?? 'Unknown error');
        } finally {
            this.loading.set(false);
        }
    }

    // Load items for a specific feature on demand
    async loadFeature(feature: string) {
        this.featureItemsLoading.set(true);
        this.featureItemsError.set(null);
        try {
            const result = await firstValueFrom(
                this.http.get<{ items: UsageRecord[] }>(`${environment.usageFunctionUrl}?feature=${feature}`)
            );
            this.featureItems.set(result.items);
        } catch (err: any) {
            this.featureItemsError.set(err?.message ?? 'Unknown error');
        } finally {
            this.featureItemsLoading.set(false);
        }
    }

    // Breakdown stats for single view TODO: review and rewrite to present more useful information
    summaryStats = computed(() => {
        const data = this.chartDataA();
        const total = data.legendItems.reduce((sum, i) => sum + i.count, 0);
        return data.legendItems.map(item => ({
            ...item,
            percent: total > 0 ? Math.round(item.count / total * 100) : 0
        }));
    });

    // Total reviewable fields for current feature
    totalFields = computed(() => {
        const items = this.featureItems();
        const statusFields = STATUS_FIELDS[this.selectedFeature()] ?? [];
        return items.reduce((total, item) =>
            total + statusFields.filter(f => (item as any)[f]).length, 0);
    });

    totalFieldsReviewed = computed(() => {
        const items = this.featureItems();
        const statusFields = STATUS_FIELDS[this.selectedFeature()] ?? [];
        return items.reduce((total, item) =>
            total + statusFields.filter(f => {
                const v = (item as any)[f];
                return v && v !== 'pending';
            }).length, 0);
    });

}