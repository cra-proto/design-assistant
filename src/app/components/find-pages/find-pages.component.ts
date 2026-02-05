import { Component, inject, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG modules
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { IftaLabelModule } from 'primeng/iftalabel';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';

//Components
import { GetTaskUrlsComponent } from './components/get-task-urls.component';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { TaskService, TaskOption } from '../../services/task.service';
import { AddPagesStateService } from '../add-pages/services/add-pages-state.service';
import { UrlValidationService } from '../add-pages/services/url-validation.service';


@Component({
    selector: 'aida-find-pages',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        GetTaskUrlsComponent,
        AutoCompleteModule, IftaLabelModule, TagModule, ProgressSpinnerModule, ButtonModule, CheckboxModule
    ],
    templateUrl: './find-pages.component.html',
    styles: ``
})
export class FindPagesComponent implements OnInit {
    // Services    
    projectState = inject(ProjectStateService);
    taskService = inject(TaskService);
    addPagesState = inject(AddPagesStateService);
    urlValidation = inject(UrlValidationService);

    // Signals
    filteredTasks = signal<TaskOption[]>([]);
    selectedTaskId = signal<number | null>(null);
    selectedTask = signal<TaskOption | null>(null);
    taskUrls = signal<{ url: string; selected: boolean }[]>([]);

    constructor() {
        effect(() => {
            const taskId = this.selectedTaskId();
            const options = this.taskService.taskOptions();
            if (taskId !== null) {
                const taskOption = options.find(opt => opt.id === taskId);
                this.selectedTask.set(taskOption || null);
                this.loadTaskUrls(taskId); // Reload URLs in the new language
            }
        });
    }

    ngOnInit() {
        this.taskService.loadTasks(); // Load task data
    }

    filterTasks(event: AutoCompleteCompleteEvent) {
        const query = event.query;
        if (!query || query.trim().length === 0) {
            this.filteredTasks.set([...this.taskService.taskOptions()]);
        } else {
            this.filteredTasks.set(this.taskService.searchTasks(query));
        }
    }

    onTaskSelect(event: AutoCompleteSelectEvent) {
        const taskOption = event.value as TaskOption;
        if (taskOption.id) {
            this.selectedTaskId.set(taskOption.id);
            this.loadTaskUrls(taskOption.id);
        }
    }

    private loadTaskUrls(taskId: number) {
        const urls = this.taskService.getTaskUrls(taskId);
        this.taskUrls.set(
            urls.map(url => ({ url, selected: true }))
        );
    }

    addUrlsToProject() { //UNFINISHED! 
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
        this.selectedTaskId.set(null);
        this.selectedTask.set(null);
        this.taskUrls.set([]);
    }
}