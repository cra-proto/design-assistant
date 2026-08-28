import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent, AutoCompleteUnselectEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { AirtableService } from '../../../services/data-sources/airtable.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { AddUrlsService } from '../../add-urls/add-urls.service';

export interface TaskOption {
  id: number;
  label: string;
  urlCount: number;
}

@Component({
  selector: 'aida-get-task-urls',
  standalone: true,
  imports: [FormsModule, TranslatePipe, AutoCompleteModule, ButtonModule, CheckboxModule, IftaLabelModule, ProgressSpinnerModule, TagModule],
  templateUrl: './get-task-urls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetTaskUrlsComponent implements OnInit {
  // Services
  public readonly airtableService = inject(AirtableService);
  private readonly translate = inject(TranslateService);
  private readonly addUrlsService = inject(AddUrlsService);
  private readonly projectState = inject(ProjectStateService);

  // Signals
  private readonly currentLanguage = signal<'en' | 'fr'>(this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en');
  protected readonly filteredTasks = signal<TaskOption[]>([]);
  protected readonly selectedTaskIds = signal<number[]>([]);
  protected readonly selectedTasks = signal<TaskOption[]>([]);
  protected readonly taskUrls = signal<{ url: string; selected: boolean }[]>([]);

  // Count selected task urls
  protected readonly selectedTaskUrlsCount = computed(() => this.taskUrls().filter((task) => task.selected).length);

  protected toggleTaskUrl(index: number, selected: boolean) {
    this.taskUrls.update((urls) => {
      const updated = [...urls];
      updated[index] = { ...updated[index], selected };
      return updated;
    });
  }

  // Computed: Transform Airtable data to TaskOptions based on current language
  private readonly taskOptions = computed(() => {
    const tasks = this.airtableService.data();
    const lang = this.currentLanguage();

    return tasks.map((task) => ({
      id: task.id,
      label: lang === 'en' ? task.taskNameEN : task.taskNameFR,
      urlCount: lang === 'en' ? task.urlsEN.length : task.urlsFR.length,
    }));
  });

  constructor() {
    // React to language changes
    effect(() => {
      const lang = this.translate.currentLang();
      if (lang) {
        this.currentLanguage.set(lang.startsWith('fr') ? 'fr' : 'en');
      }
    });

    // React to task selection and language changes
    effect(() => {
      const ids = this.selectedTaskIds();
      const options = this.taskOptions();
      const matched = ids.map((id) => options.find((opt) => opt.id === id)).filter((opt): opt is TaskOption => !!opt);

      this.selectedTasks.set(matched);

      if (ids.length > 0) {
        this.loadTaskUrls();
      }
    });
  }

  ngOnInit() {
    this.onAutocompleteInteraction(); //disable this if we want to wait for user interaction before loading data
  }

  protected async onAutocompleteInteraction() {
    if (!this.airtableService.hasData() && !this.airtableService.isLoading()) {
      await this.airtableService.fetchTasks();
    }
  }

  protected filterTasks(event: AutoCompleteCompleteEvent) {
    const query = event.query;

    if (!query || query.trim().length === 0) {
      this.filteredTasks.set([...this.taskOptions()]);
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredTasks.set(this.taskOptions().filter((option) => option.label.toLowerCase().includes(lowerQuery)));
    }
  }

  protected onTaskSelect(event: AutoCompleteSelectEvent) {
    const taskOption = event.value as TaskOption;
    if (taskOption.id) {
      this.selectedTaskIds.update((ids) => [...ids, taskOption.id]);
      this.loadTaskUrls();
    }
  }

  protected onTaskUnselect(event: AutoCompleteUnselectEvent) {
    const taskOption = event.value as TaskOption;
    this.selectedTaskIds.update((ids) => ids.filter((id) => id !== taskOption.id));
    this.loadTaskUrls();
  }

  private loadTaskUrls() {
    const tasks = this.airtableService.data();
    const lang = this.currentLanguage();
    const ids = this.selectedTaskIds();

    const allUrls = ids.flatMap((taskId) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return [];
      return lang === 'en' ? task.urlsEN : task.urlsFR;
    });

    const uniqueUrls = [...new Set(allUrls)];

    this.taskUrls.set(uniqueUrls.map((url) => ({ url, selected: true })));
  }

  protected addUrlsToProject() {
    const selectedUrls = this.taskUrls()
      .filter((item) => item.selected)
      .map((item) => item.url);
    this.addUrlsService.appendUrlsToInput(selectedUrls);
    // Clear selection after adding
    this.selectedTaskIds.set([]);
    this.selectedTasks.set([]);
    this.taskUrls.set([]);
  }
}
