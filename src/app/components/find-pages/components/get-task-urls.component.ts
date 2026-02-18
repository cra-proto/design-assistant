import { Component, inject, computed, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG modules
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent, AutoCompleteUnselectEvent } from 'primeng/autocomplete';
import { IftaLabelModule } from 'primeng/iftalabel';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

// Services
import { ProjectStateService } from '../../../services/project-state.service';
import { AirtableService } from '../../../services/airtable.service';
import { AddPagesStateService } from '../../add-pages/services/add-pages-state.service';
import { UrlValidationService } from '../../add-pages/services/url-validation.service';

export interface TaskOption {
  id: number;
  label: string;
  urlCount: number;
}

@Component({
  selector: 'aida-get-task-urls',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslateModule,
    AutoCompleteModule, IftaLabelModule, TagModule,
    ProgressSpinnerModule, ButtonModule, CheckboxModule
  ],
  templateUrl: './get-task-urls.component.html',
  styles: ``
})
export class GetTaskUrlsComponent implements OnInit {
  // Services    
  projectState = inject(ProjectStateService);
  airtableService = inject(AirtableService);
  translate = inject(TranslateService);
  addPagesState = inject(AddPagesStateService);
  urlValidation = inject(UrlValidationService);

  // Signals
  private currentLanguage = signal<'en' | 'fr'>(
    this.translate.currentLang?.startsWith('fr') ? 'fr' : 'en'
  );
  filteredTasks = signal<TaskOption[]>([]);
  selectedTaskIds = signal<number[]>([]);
  selectedTasks = signal<TaskOption[]>([]);
  taskUrls = signal<{ url: string; selected: boolean }[]>([]);

  // Count selected task urls
  selectedTaskUrlsCount = computed(() =>
    this.taskUrls().filter(task => task.selected).length
  );

  toggleTaskUrl(index: number, selected: boolean) {
    this.taskUrls.update(urls => {
      const updated = [...urls];
      updated[index] = { ...updated[index], selected };
      return updated;
    });
  }

  // Computed: Transform Airtable data to TaskOptions based on current language
  taskOptions = computed(() => {
    const tasks = this.airtableService.data();
    const lang = this.currentLanguage();

    return tasks.map(task => ({
      id: task.id,
      label: lang === 'en' ? task.taskNameEN : task.taskNameFR,
      urlCount: lang === 'en' ? task.urlsEN.length : task.urlsFR.length
    }));
  });

  constructor() {
    // React to language changes
    effect(() => {
      const lang = this.translate.currentLang;
      if (lang) {
        this.currentLanguage.set(lang.startsWith('fr') ? 'fr' : 'en');
      }
    });

    // Subscribe to translate service language changes
    this.translate.onLangChange.subscribe(event => {
      this.currentLanguage.set(event.lang.startsWith('fr') ? 'fr' : 'en');
    });

    // React to task selection and language changes
    effect(() => {
      const ids = this.selectedTaskIds();
      const options = this.taskOptions();
      const matched = ids
        .map(id => options.find(opt => opt.id === id))
        .filter((opt): opt is TaskOption => !!opt);

      this.selectedTasks.set(matched);

      if (ids.length > 0) {
        this.loadTaskUrls();
      }
    });
  }

  ngOnInit() {
    this.onAutocompleteInteraction(); //disable this if we want to wait for user interaction before loading data
  }

  async onAutocompleteInteraction() {
    if (!this.airtableService.hasData() && !this.airtableService.isLoading()) {
      await this.airtableService.fetchTasks();
    }
  }

  filterTasks(event: AutoCompleteCompleteEvent) {
    const query = event.query;

    if (!query || query.trim().length === 0) {
      this.filteredTasks.set([...this.taskOptions()]);
    } else {
      const lowerQuery = query.toLowerCase();
      this.filteredTasks.set(
        this.taskOptions().filter(option =>
          option.label.toLowerCase().includes(lowerQuery)
        )
      );
    }
  }

  onTaskSelect(event: AutoCompleteSelectEvent) {
    const taskOption = event.value as TaskOption;
    if (taskOption.id) {
      this.selectedTaskIds.update(ids => [...ids, taskOption.id]);
      this.loadTaskUrls();
    }
  }

  onTaskUnselect(event: AutoCompleteUnselectEvent) {
    const taskOption = event.value as TaskOption;
    this.selectedTaskIds.update(ids => ids.filter(id => id !== taskOption.id));
    this.loadTaskUrls();
  }

  private loadTaskUrls() {
    const tasks = this.airtableService.data();
    const lang = this.currentLanguage();
    const ids = this.selectedTaskIds();

    const allUrls = ids.flatMap(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return [];
      return lang === 'en' ? task.urlsEN : task.urlsFR;
    });

    const uniqueUrls = [...new Set(allUrls)];

    this.taskUrls.set(uniqueUrls.map(url => ({ url, selected: true })));
  }

  addUrlsToProject() {
    const selectedUrls = this.taskUrls()
      .filter(item => item.selected)
      .map(item => item.url)
      .join('\n');

    // Get existing rawUrls
    const currentRawUrls = this.addPagesState.getValidationState().rawUrls;

    // Append new URLs
    const updatedRawUrls = currentRawUrls
      ? `${currentRawUrls}\n${selectedUrls}`
      : selectedUrls;

    // Update the add pages validation state
    this.addPagesState.setValidationState({
      rawUrls: updatedRawUrls,
    });

    // Clear selection after adding
    this.selectedTaskIds.set([]);
    this.selectedTasks.set([]);
    this.taskUrls.set([]);
  }
}