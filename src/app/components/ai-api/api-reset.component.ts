import { Component, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { LocalStorageService } from '../../services/storage/local-storage.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'aida-api-reset',
  imports: [TranslateModule, ButtonModule],
  template: `
    <p-button icon="pi pi-key" [label]="'apiKey.change' | translate" [rounded]="true" outlined severity="secondary"
    id="api-key-reset-btn" class="my-2 api-button" styleClass="surface-border api-button-size" (click)="this.localStore.removeData('apiKey');" />
  `,
  styleUrl: './api-reset.component.css'
})
export class ApiResetComponent {
  localStore = inject(LocalStorageService);
}