import { Injectable } from '@angular/core';

import { OutputKey, PromptSkillBinding } from '../../common/prompts/prompt.model';
import { ResolvedSkillResource, ResolvedSkills, SkillManifest, SkillManifestEntry, SkillOutputMode, SkillResourceKind } from '../../common/skills/skill.model';

@Injectable({ providedIn: 'root' })
export class SkillService {
  private readonly manifestUrl = new URL('skills/manifest.json', document.baseURI);
  private readonly manifestBaseUrl = new URL('.', this.manifestUrl);
  private manifestPromise: Promise<SkillManifest> | null = null;
  private readonly textCache = new Map<string, Promise<string>>();

  public async getManifest(): Promise<SkillManifest> {
    this.manifestPromise ??= this.fetchJson<SkillManifest>(this.manifestUrl).then((manifest) => this.validateManifest(manifest));
    try {
      return await this.manifestPromise;
    } catch (error) {
      this.manifestPromise = null;
      throw error;
    }
  }

  public async resolveBindings(bindings: PromptSkillBinding[], output: OutputKey): Promise<ResolvedSkills> {
    if (!bindings.length) {
      return { bindings: [], skills: [], resources: [], warnings: [] };
    }

    const manifest = await this.getManifest();
    const skillMap = new Map(manifest.skills.map((skill) => [skill.id, skill]));
    const loadedSkillIds = new Set<string>();
    const loadedResourcePaths = new Set<string>();
    const skills: SkillManifestEntry[] = [];
    const resources: ResolvedSkillResource[] = [];
    const warnings: string[] = [];

    for (const binding of bindings) {
      const skill = skillMap.get(binding.id);
      if (!skill) throw new Error(`Skill not found in manifest: ${binding.id}`);
      this.validateOutputMode(skill, output);
      await this.resolveSkill({
        skill,
        skillMap,
        includeOptionalReferences: binding.includeOptionalReferences === true,
        included: false,
        activePath: [],
        loadedSkillIds,
        loadedResourcePaths,
        skills,
        resources,
      });
    }

    if (new Set(bindings.map((binding) => binding.id)).size !== bindings.length) {
      warnings.push('Duplicate prompt skill bindings were loaded once.');
    }

    return { bindings: [...bindings], skills, resources, warnings };
  }

  private async resolveSkill(params: {
    skill: SkillManifestEntry;
    skillMap: Map<string, SkillManifestEntry>;
    includeOptionalReferences: boolean;
    included: boolean;
    activePath: string[];
    loadedSkillIds: Set<string>;
    loadedResourcePaths: Set<string>;
    skills: SkillManifestEntry[];
    resources: ResolvedSkillResource[];
  }): Promise<void> {
    const { skill, skillMap, includeOptionalReferences, included, activePath, loadedSkillIds, loadedResourcePaths, skills, resources } = params;
    if (activePath.includes(skill.id)) {
      throw new Error(`Circular skill dependency: ${[...activePath, skill.id].join(' -> ')}`);
    }
    if (loadedSkillIds.has(skill.id)) return;

    loadedSkillIds.add(skill.id);
    skills.push(skill);
    const nextPath = [...activePath, skill.id];

    await this.addResource(skill, 'instructions', skill.skillMdPath, included, loadedResourcePaths, resources, true);
    for (const resourcePath of skill.defaultReferencePaths) {
      await this.addResource(skill, 'reference', resourcePath, included, loadedResourcePaths, resources);
    }
    if (includeOptionalReferences) {
      for (const resourcePath of skill.optionalReferencePaths) {
        await this.addResource(skill, 'optionalReference', resourcePath, included, loadedResourcePaths, resources);
      }
    }
    for (const resourcePath of skill.defaultAssetPaths) {
      await this.addResource(skill, 'asset', resourcePath, included, loadedResourcePaths, resources);
    }

    for (const includedSkillId of skill.includedSkillIds) {
      const includedSkill = skillMap.get(includedSkillId);
      if (!includedSkill) throw new Error(`Included skill not found in manifest: ${includedSkillId}`);
      await this.resolveSkill({
        ...params,
        skill: includedSkill,
        includeOptionalReferences: false,
        included: true,
        activePath: nextPath,
      });
    }
  }

  private async addResource(
    skill: SkillManifestEntry,
    kind: SkillResourceKind,
    resourcePath: string,
    included: boolean,
    loadedPaths: Set<string>,
    resources: ResolvedSkillResource[],
    stripFrontmatter = false,
  ): Promise<void> {
    const url = new URL(resourcePath, this.manifestBaseUrl);
    const cacheKey = url.toString();
    if (loadedPaths.has(cacheKey)) return;

    let content = await this.fetchText(url);
    if (stripFrontmatter) content = this.stripFrontmatter(content);
    loadedPaths.add(cacheKey);
    resources.push({
      skillId: skill.id,
      skillName: skill.name,
      kind,
      path: resourcePath,
      content,
      included,
    });
  }

  private validateOutputMode(skill: SkillManifestEntry, output: OutputKey): void {
    if (!skill.outputModes.length || skill.outputModes.includes('any')) return;
    const requestedMode = output.split('.').pop()?.toLowerCase() as SkillOutputMode | undefined;
    if (!requestedMode || !skill.outputModes.includes(requestedMode)) {
      throw new Error(`Skill ${skill.id} does not support the ${requestedMode ?? output} output mode.`);
    }
  }

  private validateManifest(manifest: SkillManifest): SkillManifest {
    if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.skills)) {
      throw new Error('The AWS-AIDA skill manifest is invalid or unsupported.');
    }
    const ids = new Set<string>();
    for (const skill of manifest.skills) {
      if (!skill?.id || !skill.name || !skill.description || !skill.skillMdPath) {
        throw new Error('The AWS-AIDA skill manifest contains an incomplete skill entry.');
      }
      if (ids.has(skill.id)) throw new Error(`Duplicate skill id in manifest: ${skill.id}`);
      ids.add(skill.id);
      skill.includedSkillIds ??= [];
      skill.defaultReferencePaths ??= [];
      skill.optionalReferencePaths ??= [];
      skill.defaultAssetPaths ??= [];
      skill.outputModes ??= [];
    }
    return manifest;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Skill resource request failed (${response.status}): ${url.pathname}`);
    return response.json() as Promise<T>;
  }

  private async fetchText(url: URL): Promise<string> {
    const cacheKey = url.toString();
    if (!this.textCache.has(cacheKey)) {
      this.textCache.set(
        cacheKey,
        fetch(url).then((response) => {
          if (!response.ok) throw new Error(`Skill resource request failed (${response.status}): ${url.pathname}`);
          return response.text();
        }),
      );
    }
    try {
      return await this.textCache.get(cacheKey)!;
    } catch (error) {
      this.textCache.delete(cacheKey);
      throw error;
    }
  }

  private stripFrontmatter(content: string): string {
    return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  }
}
