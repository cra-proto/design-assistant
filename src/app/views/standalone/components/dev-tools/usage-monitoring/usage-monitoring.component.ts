import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../../../environments/environment';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';

interface UsageStats {
    totalGenerations: number;
    uniqueUrls: number;
    statusCounts: Record<string, number>;
    modelCounts: Record<string, number>;
    promptCounts: Record<string, number>;
    comboCounts: Record<string, Record<string, number>>;
    items: UsageRecord[];
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
}

interface SelectOption {
    label: string;
    value: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; hoverColor: string }> = {
    approvedAI: { label: 'Approved AI', color: '#22c55e', hoverColor: '#16a34a' },
    approvedEdits: { label: 'Approved Edited', color: '#3b82f6', hoverColor: '#2563eb' },
    edited: { label: 'Edited', color: '#06b6d4', hoverColor: '#0891b2' },
    pending: { label: 'Pending', color: '#f59e0b', hoverColor: '#d97706' },
    rejected: { label: 'Rejected', color: '#ef4444', hoverColor: '#dc2626' },
    noChange: { label: 'No Change', color: '#94a3b8', hoverColor: '#64748b' },
};

const FIELD_OPTIONS: SelectOption[] = [
    { label: 'All fields', value: 'all' },
    { label: 'EN description', value: 'statusDescEN' },
    { label: 'FR description', value: 'statusDescFR' },
    { label: 'EN keywords', value: 'statusKeywordsEN' },
    { label: 'FR keywords', value: 'statusKeywordsFR' },
];

@Component({
    selector: 'aida-usage-monitoring',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        CardModule, ProgressBarModule, TagModule,
        SkeletonModule, DividerModule, ButtonModule, TooltipModule,
        ChartModule, SelectModule
    ],
    templateUrl: 'usage-monitoring.component.html',
})
export class UsageMonitoringComponent implements OnInit {
    private http = inject(HttpClient);

    stats = signal<UsageStats | null>(null);
    loading = signal(true);
    error = signal<string | null>(null);

    markForTranslation() {
    }

    private readonly statusConfig: Record<string, { label: string, severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }> = {
        approvedAI: { label: 'Approved AI', severity: 'success' },
        approvedEdits: { label: 'Approved Edited', severity: 'info' },
        edited: { label: 'Edited', severity: 'info' },
        pending: { label: 'Pending', severity: 'warn' },
        rejected: { label: 'Rejected', severity: 'danger' },
        noChange: { label: 'No Change', severity: 'secondary' },
    };

    /*
    totalFields = computed(() => {
        const counts = this.stats()?.statusCounts ?? {};
        return Object.values(counts).reduce((a, b) => a + b, 0);
    });

    totalFieldsReviewed = computed(() => {
        const counts = this.stats()?.statusCounts ?? {};
        return Object.entries(counts)
            .filter(([k]) => k !== 'pending')
            .reduce((a, [, v]) => a + v, 0);
    });

    */
    statusRows = computed(() => {
        const counts = this.stats()?.statusCounts ?? {};
        const total = this.totalFields();
        return Object.entries(counts).map(([key, count]) => ({
            key,
            label: this.statusConfig[key]?.label ?? key,
            severity: this.statusConfig[key]?.severity ?? 'secondary',
            count,
            percent: total > 0 ? Math.round(count / total * 100) : 0
        })).sort((a, b) => b.count - a.count);
    });

    modelRows = computed(() =>
        Object.entries(this.stats()?.modelCounts ?? {})
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
    );

    promptRows = computed(() =>
        Object.entries(this.stats()?.promptCounts ?? {})
            .map(([version, count]) => ({ version, count }))
            .sort((a, b) => b.count - a.count)
    );

    objectKeys = Object.keys;

    async ngOnInit() {
        await this.load();
    }

    async load() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const result = await firstValueFrom(
                this.http.get<UsageStats>(environment.usageFunctionUrl)
            );
            this.stats.set(result);
        } catch (err: any) {
            this.error.set(err?.message ?? 'Unknown error');
        } finally {
            this.loading.set(false);
        }
    }

    // Test donut chart
    fieldOptions = FIELD_OPTIONS;

    // Filter state for each donut — default to meaningful comparison
    filterA = signal<DonutFilter>({ field: 'all', model: 'all', promptVersion: 'all' });
    filterB = signal<DonutFilter>({ field: 'statusDescEN', model: 'all', promptVersion: 'all' });

    chartOptions = {
        cutout: '65%',
        plugins: {
            legend: { display: false }
        }
    };

    // Dynamic dropdown options derived from data
    modelOptions = computed<SelectOption[]>(() => {
        const models = Object.keys(this.stats()?.modelCounts ?? {});
        return [
            { label: 'All models', value: 'all' },
            ...models.map(m => ({ label: m, value: m }))
        ];
    });

    promptOptions = computed<SelectOption[]>(() => {
        const versions = Object.keys(this.stats()?.promptCounts ?? {});
        return [
            { label: 'All versions', value: 'all' },
            ...versions.map(v => ({ label: `Prompt ${v}`, value: v }))
        ];
    });

    totalFields = computed(() =>
        Object.values(this.stats()?.statusCounts ?? {}).reduce((a, b) => a + b, 0)
    );

    totalFieldsReviewed = computed(() =>
        Object.entries(this.stats()?.statusCounts ?? {})
            .filter(([k]) => k !== 'pending')
            .reduce((a, [, v]) => a + v, 0)
    );

    chartDataA = computed(() => this.buildChartData(this.filterA()));
    chartDataB = computed(() => this.buildChartData(this.filterB()));

    private buildChartData(filter: DonutFilter) {
        const items = this.stats()?.items ?? [];

        // Apply filters
        const filtered = items.filter(item => {
            if (filter.model !== 'all' && item.model !== filter.model) return false;
            if (filter.promptVersion !== 'all' && `v${item.promptVersion}` !== filter.promptVersion) return false;
            return true;
        });

        // Collect status values for selected field(s)
        const statusFields = filter.field === 'all'
            ? ['statusDescEN', 'statusDescFR', 'statusKeywordsEN', 'statusKeywordsFR']
            : [filter.field];

        const counts: Record<string, number> = {};
        for (const item of filtered) {
            for (const field of statusFields) {
                const status = (item as any)[field];
                if (status) counts[status] = (counts[status] ?? 0) + 1;
            }
        }

        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        return {
            labels: entries.map(([k]) => STATUS_CONFIG[k]?.label ?? k),
            datasets: [{
                data: entries.map(([, v]) => v),
                backgroundColor: entries.map(([k]) => STATUS_CONFIG[k]?.color ?? '#94a3b8'),
                hoverBackgroundColor: entries.map(([k]) => STATUS_CONFIG[k]?.hoverColor ?? '#64748b'),
            }],
            legendItems: entries.map(([k, v]) => ({
                label: STATUS_CONFIG[k]?.label ?? k,
                color: STATUS_CONFIG[k]?.color ?? '#94a3b8',
                count: v
            }))
        };
    }

    updateFilterA(key: keyof DonutFilter, value: string) {
        this.filterA.update(f => ({ ...f, [key]: value }));
    }

    updateFilterB(key: keyof DonutFilter, value: string) {
        this.filterB.update(f => ({ ...f, [key]: value }));
    }
}