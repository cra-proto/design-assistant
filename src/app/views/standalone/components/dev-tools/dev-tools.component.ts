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
    <h2>{{ 'dev._title' | translate}}</h2>
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
    marker('help._');
    marker('about._');
    marker('notFound._');
    marker('dev._');
    marker('standalone._');
    marker('aiPrompt._');
    marker('importPage._');
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
}
