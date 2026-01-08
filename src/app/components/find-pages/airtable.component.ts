import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { AirtableService } from '../../services/airtable.service';

@Component({
  selector: 'aida-airtable',
  standalone: true,
  imports: [CommonModule, ButtonModule, ProgressSpinnerModule, MessageModule],
  template: `
    <div class="p-4">
      <h1>Airtable Connection Test</h1>
      
      <div class="mb-3">
        <p-button 
          label="Fetch Records" 
          icon="pi pi-refresh"
          (onClick)="loadRecords()"
          [loading]="airtableService.isLoading()"
          [disabled]="airtableService.isLoading()">
        </p-button>
      </div>

      @if (airtableService.isLoading()) {
        <div class="flex align-items-center gap-2">
          <p-progressSpinner 
            styleClass="w-2rem h-2rem" 
            strokeWidth="4">
          </p-progressSpinner>
          <span>Loading records...</span>
        </div>
      }

      @if (airtableService.hasError()) {
        <p-message 
          severity="error" 
          [text]="airtableService.errorMessage() || 'An error occurred'">
        </p-message>
      }

      @if (airtableService.data().length > 0) {
        <div class="mt-3">
          <h3>Records ({{ airtableService.data().length }} total)</h3>
          <pre class="surface-100 p-3 border-round overflow-auto" style="max-height: 600px;">{{ airtableService.data() | json }}</pre>
        </div>
      }
    </div>
  `,
  styles: [`
    pre {
      font-size: 0.875rem;
      line-height: 1.5;
    }
  `]
})
export class AirtableComponent implements OnInit {
  airtableService = inject(AirtableService);

  async ngOnInit(): Promise<void> {
    await this.airtableService.fetchTasks();
    const tasks = this.airtableService.data();

    // Search tasks
    // const results = this.airtableService.searchTasks('tax', 'en');
  }

  async loadRecords(): Promise<void> {
    await this.airtableService.refreshData();
  }
}