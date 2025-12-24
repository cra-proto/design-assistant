import { Component, OnInit, inject, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { FilterService, SelectItemGroup, TreeNode } from 'primeng/api';
import { KeyFilterModule } from 'primeng/keyfilter';
import { MessageModule } from 'primeng/message';
import { FieldsetModule } from 'primeng/fieldset';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';

import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStateService } from '../../services/project-state.service';
import { FetchService } from '../../services/fetch.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';

export interface PageData {
  url: string;
  content: string;
}

interface FileCompareRow {
  path: string;
  location: 'update' | 'skip' | 'new page' | 'github only';
  newer?: 'export' | 'github' | 'same';
}

@Component({
  selector: 'aida-export-github',
  imports: [CommonModule, FormsModule, TranslateModule,
    SetupRepoComponent,
    TableModule, IftaLabelModule, InputTextModule, KeyFilterModule, AutoCompleteModule, PasswordModule, ButtonModule, MessageModule, FieldsetModule, ChipModule, TooltipModule],
  templateUrl: './export-github.component.html',
  styles: ``
})
export class ExportGithubComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);

  @Input() mode: 'export' | 'select' = 'export';

  projectData = this.projectState.getProject;
  gitHubData = this.projectData().github;
  repos: string[] = [];
  filteredRepos: string[] = [];
  ownerError = '';
  showHelp = false;

  async ngOnInit() {
    //this.projectState.loadFromLocalStorage();
    await this.compareFiles(this.gitHubData.owner, this.gitHubData.repo, this.gitHubData.branch, this.exportGitHubService.token);
  }

  //Get in-scope URLs and page content
  private async getUrlandContent(node: TreeNode): Promise<PageData[]> {
    const pages: PageData[] = [];
    if (node.data.status.inScope && node.data.url) {
      try {
        const doc = await this.fetchService.fetchContent(node.data.url, "prod");
        const jekyllFormatted = await this.exportGitHubService.formatDocumentAsJekyll(doc, node.data.url, this.gitHubData.owner, this.gitHubData.repo);
        pages.push({ url: node.data.url, content: jekyllFormatted });
      } catch (error) {
        console.error(`Error fetching content for ${node.data.url}:`, error);
      }
    }
    // recurse into children
    if (node.children) {
      for (const child of node.children) {
        const childPages = await this.getUrlandContent(child);
        pages.push(...childPages);
      }
    }
    return pages;
  }

  async exportProjectToGitHub(owner: string, repo: string, branch: string, token: string, overwrite = false) {

    //Step 0: Save current GitHub data to state
    this.projectState.setGitHubRepo({ owner, repo, branch });
    this.projectState.saveToLocalStorage();

    // Step 1: Gather all in-scope URLs and their content
    const nodes = this.projectState.getProjectTree();
    const pages: PageData[] = await this.getUrlandContent(nodes[0]);
    console.log('Exporting pages to GitHub:', pages);

    // Step 2: Find common path prefix
    function getCommonPrefix(urls: string[]): string {
      const paths = urls.map(url => new URL(url).pathname.split("/").filter(Boolean));
      const first = paths[0];
      const prefix: string[] = [];

      for (let i = 0; i < first.length; i++) {
        const segment = first[i];
        if (paths.every(p => p[i] === segment)) {
          prefix.push(segment);
        } else {
          break;
        }
      }
      if (prefix.length) {
        const last = prefix[prefix.length - 1];
        if (/\.[a-z0-9]+$/i.test(last)) { // ends with file extension
          prefix.pop();
        }
      }
      return "/" + prefix.join("/");
    }

    const urls = pages.map(page => page.url);
    const commonRoot = getCommonPrefix(urls);
    console.log("Detected common root:", commonRoot);

    // Step 3: Trim common root from urls for GitHub paths
    const exportPages = pages.map(p => {
      let path = new URL(p.url).pathname;
      //comment out this if statement if we want paths to start at /en & /fr
      //if (path.startsWith(commonRoot)) {
      //  path = path.slice(commonRoot.length);
      //}
      path = path.replace(/^\/+/, ""); // strip leading slashes
      const lastSegment = path.split("/").pop() || "index.html";
      //console.log(`Mapping URL ${p.url} to path ${path}, filename ${lastSegment}`);
      return { url: p.url, path, content: p.content, filename: lastSegment };
    });

    console.log("Exporting pages to GitHub:", exportPages);

    // Step 4: Check existing files in repo
    const existingFiles = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    //console.warn("Existing files in repo:", existingFiles);

    // Step 5: Set up repo (create it if it doesn't exist, add _config.yml and copy over core files)
    await this.exportGitHubService.setupRepo(owner, repo, branch, token, existingFiles);

    console.log("Repository setup complete.");


    // Step 6: Export each page to GitHub
    const redirects: { origin: string; destination: string }[] = [];
    for (const page of exportPages) {
      try {
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, existingFiles, overwrite);
        //console.log(`Successfully exported ${page.path}:`, result);
        redirects.push({ origin: page.url, destination: `/${repo}/${page.path}` });
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 5: Add redirect file
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, existingFiles, overwrite);

    console.log("Page export complete.");
  }

  //Create file list
  filesTable = signal<FileCompareRow[]>([]);
  updatedCount = computed(() =>
    this.filesTable().filter(f => f.location === 'update').length
  );

  newCount = computed(() =>
    this.filesTable().filter(f => f.location === 'new page').length
  );

  async compareFiles(owner: string, repo: string, branch: string, token?: string) {
    console.log("Compare!")

    const nodes = this.projectState.getProjectTree();
    const pageData: PageData[] = await this.getUrlandContent(nodes[0]);
    const inScopePages = new Map<string, string>(pageData.map(page => [page.url.replace("https://www.canada.ca/", ""), page.content]));

    const githubPages: Map<string, string> = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);

    const githubFilePatterns = [
      /^_config\.yml$/,
      /^index\.html$/,
      /^README\.md$/,
      /^_includes\/header\/header\.html$/,
      /^_includes\/resources-inc\/footer\.html$/,
      /^source\/data\/exclude-redirect-links\.json$/,
      /^source\/exit-intent-e\.html$/,
      /^source\/exit-intent-f\.html$/,
      /^404\.html$/,
      /^en\/.*/,   // anything under /en/
      /^fr\/.*/,   // anything under /fr/
    ];

    const filteredGithubPages = new Map(
      [...githubPages].filter(([path]) =>
        githubFilePatterns.some((pattern) => pattern.test(path))
      )
    );

    // Jekyll files created or copied by the Design Assistant
    const jekyllUpdateFiles: { path: string; content: string }[] = [
      { path: "404.html", content: "<!-- 404 page -->" }, //copied from core-prototype
      { path: "_includes/header/header.html", content: "<!-- header -->" }, //copied from core-prototype
      { path: "_includes/resources-inc/footer.html", content: "<!-- footer -->" }, //copied from core-prototype
      { path: "source/exit-intent-e.html", content: "<!-- exit intent - english -->" }, //copied from core-prototype
      { path: "source/data/exclude-redirect-links.json", content: "<!-- redirects -->" }, //generated for all pages in repo
    ];

    const jekyllSkipFiles: { path: string; content: string }[] = [
      { path: "_config.yml", content: "<!-- config -->" }, //genertated
      { path: "README.md", content: "<!-- readme -->" }, //generated
    ];

    // Add all Jekyll files to export list
    [...jekyllUpdateFiles, ...jekyllSkipFiles].forEach(file => {
      inScopePages.set(file.path, file.content);
    });

    //De-dupe paths
    const allPaths = new Set<string>([
      ...inScopePages.keys(),
      ...filteredGithubPages.keys(),
    ]);

    console.log(allPaths);

    //Table data
    const table: FileCompareRow[] = [];
    for (const path of allPaths) {
      const inExport = inScopePages.has(path);
      const inGitHub = filteredGithubPages.has(path);
      const isAutoUpdateFile = jekyllUpdateFiles.some(f => f.path === path);
      const isAlwaysSkipFile = jekyllSkipFiles.some(f => f.path === path);

      let location: FileCompareRow['location'];
      if (inExport && inGitHub) {
        if (isAutoUpdateFile) location = 'update';
        else if (isAlwaysSkipFile) location = 'skip';
        else location = 'skip';
      }
      else if (inExport) location = 'new page';
      else location = 'github only';

      table.push({ path, location });
    }

    this.filesTable.set(table);
  }

  getIcon(location: string): string {
    switch (location) {
      case 'skip': return 'pi pi-angle-double-right';
      case 'update': return 'pi pi-sync';
      case 'new page': return 'pi pi-file-plus';
      case 'github only': return 'pi pi-github';
      default: return '';
    }
  }

  toggleUpdate(file: FileCompareRow) {
    if (file.location === 'skip') {
      file.location = 'update';
    } else if (file.location === 'update') {
      file.location = 'skip';
    }
    this.filesTable.set([...this.filesTable()]); // triggers UI refresh
  }

  setAll(target: 'skip' | 'update') {
    const updated = this.filesTable().map(file => {
      if (file.location === 'skip' || file.location === 'update') {
        return { ...file, location: target };
      }
      return file;
    });
    this.filesTable.set(updated);
  }

  //TESTING
  public authService = inject(GitHubAuthService);
  private http = inject(HttpClient);

  isExporting = signal(false);
  exportMessage = signal<{ severity: string; text: string } | null>(null);

  async exportToGitHub() {
    const token = this.authService.getToken();
    if (!token) return;

    this.isExporting.set(true);
    this.exportMessage.set(null);

    try {
      // Example: Create a file in a repo
      const response = await fetch('https://api.github.com/repos/OWNER/REPO/contents/path/to/file.txt', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Add file via app',
          content: btoa('Your file content here'), // Base64 encode
        })
      });

      if (response.ok) {
        this.exportMessage.set({
          severity: 'success',
          text: 'Successfully exported to GitHub!'
        });
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      this.exportMessage.set({
        severity: 'error',
        text: 'Failed to export to GitHub'
      });
    } finally {
      this.isExporting.set(false);
    }
  }
}
