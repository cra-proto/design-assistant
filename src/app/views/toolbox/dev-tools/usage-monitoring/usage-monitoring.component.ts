import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { firstValueFrom } from 'rxjs';

import { SelectItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { DividerModule } from 'primeng/divider';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { UserSettingsService } from '../../../../services/user-settings.service';

import { environment } from '../../../../../environments/environment';

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

  exportCountGit: number;
  enPageCountGit: number;
  frPageCountGit: number;

  uniqueReposGit: number;
  prototypeReposGit: number;
  baselineReposGit: number;

  exportCountLocal: number;
  enPageCountLocal: number;
  frPageCountLocal: number;

  uniqueReposLocal: number;
  prototypeReposLocal: number;
  baselineReposLocal: number;

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

const STATUS_FIELDS: Record<string, (keyof UsageRecord)[]> = {
  metadata: ['statusDescEN', 'statusDescFR', 'statusKeywordsEN', 'statusKeywordsFR'],
  // page: ['statusAccepted', 'statusRejected'],     // update when ready
  // problems: ['statusAccepted', 'statusRejected'], // update when ready
};

@Component({
  selector: 'aida-usage-monitoring',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    BreadcrumbModule,
    ButtonModule,
    ChartModule,
    DividerModule,
    IftaLabelModule,
    SelectButtonModule,
    SelectModule,
    SkeletonModule,
    ToggleButtonModule,
  ],
  templateUrl: 'usage-monitoring.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsageMonitoringComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(UserSettingsService);
  protected readonly currentLang = this.settingsService.currentLang;

  // Breadcrumbs
  protected readonly breadcrumbs = [{ label: 'dev._title', route: '/dev' }, { label: 'dev.monitoring._title' }];

  // Global stats (always loaded)
  protected readonly stats = signal<UsageStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Feature stats (loaded per feature)
  private readonly featureItems = signal<UsageRecord[]>([]);
  protected readonly featureItemsLoading = signal(false);
  protected readonly featureItemsError = signal<string | null>(null);

  // Button to switch features
  protected readonly selectedFeature = signal<string>('metadata');

  protected readonly featureOptions = computed<SelectItem[]>(() => {
    this.currentLang();
    return [
      { label: this.translate.instant('dev.monitoring.metadata'), value: 'metadata' },
      { label: this.translate.instant('dev.monitoring.page'), value: 'page' },
      // { label: this.translate.instant('dev.monitoring.problems'), value: 'problems' },
    ];
  });

  protected readonly selectedFeatureLabel = computed(() => {
    const label = this.featureOptions().find((f) => f.value === this.selectedFeature())?.label ?? this.selectedFeature();
    return this.currentLang() === 'en' ? label.charAt(0).toUpperCase() + label.slice(1) : label.toLowerCase();
  });

  // Button to toggle view (single & A/B)
  protected readonly compareMode = signal<boolean>(false);

  // Filter state for each donut — TODO: default to meaningful comparison
  protected readonly filterA = signal<DonutFilter>({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
  protected readonly filterB = signal<DonutFilter>({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });

  protected updateFilterA(key: keyof DonutFilter, value: string) {
    this.filterA.update((f) => ({ ...f, [key]: value }));
  }

  protected updateFilterB(key: keyof DonutFilter, value: string) {
    this.filterB.update((f) => ({ ...f, [key]: value }));
  }

  protected onFeatureChange(feature: string) {
    this.selectedFeature.set(feature);
    this.filterA.set({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
    this.filterB.set({ field: 'all', model: 'all', promptVersion: 'all', userId: 'all' });
    this.loadFeature(feature);
  }

  // Chart options
  protected readonly chartDataA = computed(() => this.buildChartData(this.filterA()));
  protected readonly chartDataB = computed(() => this.buildChartData(this.filterB()));

  protected readonly chartOptions = {
    cutout: '65%',
    plugins: {
      legend: { display: false },
    },
  };

  // Filter - Field or prompt type options
  protected readonly fieldOptions = computed<SelectItem[]>(() => {
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
    const types = [
      ...new Set(
        this.featureItems()
          .map((i) => i.promptType)
          .filter(Boolean),
      ),
    ] as string[];
    return [{ label: this.translate.instant('dev.monitoring.filter.allPromptTypes'), value: 'all' }, ...types.map((t) => ({ label: t, value: t }))];
  });

  // Filter - AI model options
  protected readonly modelOptions = computed<SelectItem[]>(() => {
    this.currentLang();
    const models = [
      ...new Set(
        this.featureItems()
          .map((i) => i.model)
          .filter(Boolean),
      ),
    ];
    return [{ label: this.translate.instant('dev.monitoring.filter.allModels'), value: 'all' }, ...models.map((m) => ({ label: m, value: m }))];
  });

  // Filter - prompt version options
  protected readonly promptOptions = computed<SelectItem[]>(() => {
    this.currentLang();
    const versions = [
      ...new Set(
        this.featureItems()
          .map((i) => `v${i.promptVersion}`)
          .filter(Boolean),
      ),
    ];
    return [
      { label: this.translate.instant('dev.monitoring.filter.allVersions'), value: 'all' },
      ...versions.map((v) => ({ label: `${this.translate.instant('dev.monitoring.filter.prompt')} ${v}`, value: v })),
    ];
  });

  // Filter - userId options
  protected readonly userOptions = computed<SelectItem[]>(() => {
    this.currentLang();
    const users = [
      ...new Set(
        this.featureItems()
          .map((i) => i.userId)
          .filter(Boolean),
      ),
    ];
    return [{ label: this.translate.instant('dev.monitoring.filter.allUsers'), value: 'all' }, ...users.map((m) => ({ label: m, value: m }))];
  });

  // Build the chart
  private buildChartData(filter: DonutFilter) {
    const items = this.featureItems();
    const isMetadata = this.selectedFeature() === 'metadata';

    const filtered = items.filter((item) => {
      if (filter.model !== 'all' && item.model !== filter.model) return false;
      if (filter.promptVersion !== 'all' && `v${item.promptVersion}` !== filter.promptVersion) return false;
      // For page/problems: filter by promptType using the field filter
      if (!isMetadata && filter.field !== 'all' && item.promptType !== filter.field) return false;
      return true;
    });

    const statusFields = isMetadata ? (filter.field === 'all' ? STATUS_FIELDS['metadata'] : [filter.field]) : (STATUS_FIELDS[this.selectedFeature()] ?? []);

    const counts: Record<string, number> = {};
    for (const item of filtered) {
      for (const field of statusFields) {
        const status = item[field as keyof UsageRecord];
        if (status) counts[status] = (counts[status] ?? 0) + 1;
      }
    }

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    return {
      labels: entries.map(([k]) => this.statusConfig()[k]?.label ?? k),
      datasets: [
        {
          data: entries.map(([, v]) => v),
          backgroundColor: entries.map(([k]) => this.statusConfig()[k]?.color ?? '#94a3b8'),
          hoverBackgroundColor: entries.map(([k]) => this.statusConfig()[k]?.hoverColor ?? '#64748b'),
        },
      ],
      legendItems: entries.map(([k, v]) => ({
        label: this.statusConfig()[k]?.label ?? k,
        color: this.statusConfig()[k]?.color ?? '#94a3b8',
        count: v,
      })),
    };
  }

  // Status's for legend
  private readonly statusConfig = computed<Record<string, { label: string; color: string; hoverColor: string }>>(() => {
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
      pending: { color: this.getColour('--p-zinc-200'), hoverColor: this.getColour('--p-zinc-300') },
      rejected: { color: this.getColour('--p-red-400'), hoverColor: this.getColour('--p-red-500') },
      noChange: { color: this.getColour('--p-slate-200'), hoverColor: this.getColour('--p-slate-300') },
    };
    await this.load();
  }

  // Load global stats + default feature items
  protected async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [statsResult, itemsResult] = await Promise.all([
        firstValueFrom(this.http.get<UsageStats>(environment.usageFunctionUrl)),
        firstValueFrom(this.http.get<{ items: UsageRecord[] }>(`${environment.usageFunctionUrl}?feature=${this.selectedFeature()}`)),
      ]);
      this.stats.set(statsResult);
      this.featureItems.set(itemsResult.items);
    } catch (err: unknown) {
      this.error.set(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      this.loading.set(false);
    }
  }

  // Load items for a specific feature on demand
  protected async loadFeature(feature: string) {
    this.featureItemsLoading.set(true);
    this.featureItemsError.set(null);
    try {
      const result = await firstValueFrom(this.http.get<{ items: UsageRecord[] }>(`${environment.usageFunctionUrl}?feature=${feature}`));
      this.featureItems.set(result.items);
    } catch (err: unknown) {
      this.featureItemsError.set(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      this.featureItemsLoading.set(false);
    }
  }

  // Breakdown stats for single view TODO: review and rewrite to present more useful information
  protected readonly summaryStats = computed(() => {
    const data = this.chartDataA();
    const total = data.legendItems.reduce((sum, i) => sum + i.count, 0);
    return data.legendItems.map((item) => ({
      ...item,
      percent: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  });

  // Total reviewable fields for current feature
  protected readonly totalFields = computed(() => {
    const items = this.featureItems();
    const statusFields = STATUS_FIELDS[this.selectedFeature()] ?? [];
    return items.reduce((total, item) => total + statusFields.filter((f) => item[f]).length, 0);
  });

  protected readonly totalFieldsReviewed = computed(() => {
    const items = this.featureItems();
    const statusFields = STATUS_FIELDS[this.selectedFeature()] ?? [];
    return items.reduce(
      (total, item) =>
        total +
        statusFields.filter((f) => {
          const v = item[f];
          return v && v !== 'pending';
        }).length,
      0,
    );
  });
}
