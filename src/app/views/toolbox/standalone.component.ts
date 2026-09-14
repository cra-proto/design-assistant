import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { BookmarkletKey, BookmarkletsComponent } from '../../components/bookmarklets/bookmarklets.component';
import { DoormatKey, DoormatsComponent } from '../../components/doormats/doormats.component';
import { DevToolsComponent } from '../toolbox/dev-tools/dev-tools.component';

import { UserSettingsService } from '../../services/user-settings.service';

@Component({
  selector: 'aida-standalone',
  imports: [TranslatePipe, BookmarkletsComponent, DevToolsComponent, DoormatsComponent],
  templateUrl: 'standalone.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandaloneComponent {
  private settingsService = inject(UserSettingsService);

  protected readonly standaloneDoormats: DoormatKey[] = ['standaloneCompare'];
  protected readonly standaloneBookmarklets: BookmarkletKey[] = ['aida', 'githubToggle', 'githubNewTab', 'linkChecker', 'nightMode'];

  // For group-specific tools
  myToolbox = this.settingsService.toolbox;
}
