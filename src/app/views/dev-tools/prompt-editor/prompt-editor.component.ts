import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';

import { UserSettingsComponent } from '../../../components/user-settings/user-settings.component';

import { ThemeService } from '../../../services/theme.service';
import { updatePreset } from '@primeng/themes';

@Component({
    selector: 'aida-prompt-editor',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule, RouterLink,
        BreadcrumbModule, ButtonModule, TagModule, BadgeModule, MessageModule,
        DividerModule
    ],
    templateUrl: './prompt-editor.component.html',
    styles: ``
})
export class PromptEditorComponent {


    breadcrumbs = [{ label: 'example._title', route: '/test' }, { label: 'example.prompt._title' }]


}
