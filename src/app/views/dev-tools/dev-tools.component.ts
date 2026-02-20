import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { RouterLink } from '@angular/router';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'aida-dev-tools',
  imports: [TranslateModule, CommonModule, FormsModule, CheckboxModule, RouterLink, ButtonModule],
  template: `
    <h1 id="wb-cont">{{ 'dev._title' | translate}}</h1>
    <p [innerHTML]="'dev.description' | translate"></p>
   
    <div class="grid py-2 px-4 lg:px-6">      
        <div class="col-12 md:col-6 lg:col-4">
          <a routerLink="/dev/color-generator" class="text-xl font-semibold">{{'dev.colors._title' | translate}}</a>
          <p class="text-color-secondary mt-2">{{'dev.colors.description' | translate}}</p>
        </div>
        <div class="col-12 md:col-6 lg:col-4">
          <a routerLink="/dev/design-patterns" class="text-xl font-semibold">{{'dev.patterns._title' | translate}}</a>
          <p class="text-color-secondary mt-2">{{'dev.patterns.description' | translate}}</p>
        </div>
        <div class="col-12 md:col-6 lg:col-4">
          <a routerLink="/dev/prompt-editor" class="text-xl font-semibold">{{'dev.prompts._title' | translate}}</a>
          <p class="text-color-secondary mt-2">{{'dev.prompts.description' | translate}}</p>
        </div>
  </div>
    
<div class="card">
  <h2>Temporary component QA checklist for release 0.4</h2>

  <div class="grid">
    @for (component of componentChecklist; track component.name) {
      @if (component.isHeader) {
        <div class="col-12">
          <h2 class="text-primary mb-0">{{ component.name }}</h2>
        </div>
      } @else {
        <div class="col-12 border-bottom-1 surface-border py-3">
          <h3 class="mt-0 mb-3">{{ component.name }}</h3>
          <div class="flex flex-wrap gap-3">
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.translations" [binary]="true" inputId="{{component.name}}-trans" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-trans'" class="ml-2">Translations</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.help" [binary]="true" inputId="{{component.name}}-help" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-help'" class="ml-2">Help Messages</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.reactivity" [binary]="true" inputId="{{component.name}}-react" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-react'" class="ml-2">Reactivity</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.unusedFunctions" [binary]="true" inputId="{{component.name}}-unused" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-unused'" class="ml-2">Functions</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.lint" [binary]="true" inputId="{{component.name}}-lint" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-lint'" class="ml-2">Lint Errors</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.consoleLogs" [binary]="true" inputId="{{component.name}}-console" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-console'" class="ml-2">Log Cleanup</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.responsive" [binary]="true" inputId="{{component.name}}-responsive" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-responsive'" class="ml-2">Responsive UI</label>
            </div>
            <div class="flex align-items-center">
              <p-checkbox [(ngModel)]="component.aria" [binary]="true" inputId="{{component.name}}-aria" (onChange)="saveChecklist()" />
              <label [for]="component.name + '-aria'" class="ml-2">ARIA Attributes</label>
            </div>
          </div>
        </div>
      }
    }
  </div>
</div>
<div class="flex flex-row gap-2 mt-4">
  <p-button (click)="resetChecklist()" severity="danger">Reset to stored state</p-button>
  <p-button (click)="exportChecklist()" severity="secondary">Export progress to console</p-button>
</div>
  `,
  styles: ``
})
export class DevToolsComponent {
  /**
  * Translation markers for visual separators in translation files.
  * These keys (feature._) create visual breaks between feature sections.
  * DO NOT REMOVE - needed to preserve separators during i18n:clean
  */
  markForTranslation() {
    //Views
    marker('dashboard._');
    marker('project._');
    marker('switch._');
    marker('inventory._');
    marker('iaDiagram._');
    marker('github._');
    marker('about._');
    marker('notFound._');
    marker('dev._');
    marker('standalone._');
    marker('aiPrompt._');
    // Components
    marker('nav._');
    marker('export._');
    marker('settings._');
    marker('collaborators._');
    marker('addPages._');
    marker('findPages._');
    marker('project.github._');
    marker('project.message._');
    marker('project.phase._');
    marker('project.setup._');
    marker('save._');
    marker('feedback._');
    //Other
    marker('common._');
    marker('common.no');
    marker('common.save');
    marker('common.delete');
    marker('common.cra');
  }

  private initialChecklist = [
    {
      "isHeader": true,
      "name": "Sub-components"
    },
    {
      "name": "Add Collaborators",
      "translations": true,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": true,
      "consoleLogs": true,
      "responsive": true,
      "aria": false
    },
    {
      "name": "Add Pages",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Auth Callback",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Export Project",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Find Pages",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Get Task URLs",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "GitHub Connect",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "PAT",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Setup Project",
      "translations": true,
      "reactivity": true,
      "unusedFunctions": true,
      "lint": true,
      "help": true,
      "consoleLogs": true,
      "responsive": true,
      "aria": false
    },
    {
      "name": "Setup Repo",
      "translations": true,
      "reactivity": true,
      "unusedFunctions": true,
      "lint": true,
      "help": true,
      "consoleLogs": true,
      "responsive": true,
      "aria": false
    },
    {
      "name": "User Settings",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "isHeader": true,
      "name": "Template"
    },
    {
      "name": "Header",
      "translations": true,
      "reactivity": true,
      "unusedFunctions": true,
      "lint": true,
      "help": true,
      "consoleLogs": true,
      "responsive": true,
      "aria": true
    },
    {
      "name": "Sidebar",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Footer",
      "translations": true,
      "reactivity": true,
      "unusedFunctions": true,
      "lint": true,
      "help": true,
      "consoleLogs": true,
      "responsive": true,
      "aria": true
    },
    {
      "name": "App",
      "translations": true,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "isHeader": true,
      "name": "Main Views"
    },
    {
      "name": "Dashboard",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Edit Project",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Switch Project",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Inventory",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "IA Diagram",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Export GitHub",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "About",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Not Found",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "isHeader": true,
      "name": "Dev Components"
    },
    {
      "name": "Example",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Color Picker",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Color Test",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": true,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Copy Preset",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    },
    {
      "name": "Design Patterns",
      "translations": false,
      "reactivity": false,
      "unusedFunctions": false,
      "lint": false,
      "help": false,
      "consoleLogs": false,
      "responsive": false,
      "aria": false
    }
  ]

  componentChecklist: any[] = [...this.initialChecklist];

  ngOnInit() {
    //localStorage.removeItem('componentQAChecklist'); // Uncomment to reset checklist (or to force dev to new key with my updates)<p-button (click)="exportChecklist()">Export Progress</p-button>
    const saved = localStorage.getItem('componentQAChecklist');
    if (saved) {
      this.componentChecklist = JSON.parse(saved);
    }
  }

  saveChecklist() {
    localStorage.setItem('componentQAChecklist', JSON.stringify(this.componentChecklist));
  }

  exportChecklist() {
    console.log(JSON.stringify(this.componentChecklist, null, 2));
  }

  resetChecklist() {
    this.componentChecklist = JSON.parse(JSON.stringify(this.initialChecklist))
    localStorage.removeItem('componentQAChecklist');
    this.saveChecklist();
  }

}
