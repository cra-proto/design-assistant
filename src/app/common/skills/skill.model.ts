import { PromptSkillBinding } from '../prompts/prompt.model';

export type SkillOutputMode = 'any' | 'html' | 'json' | 'text';
export type SkillResourceKind = 'instructions' | 'reference' | 'optionalReference' | 'asset';

export interface SkillManifestEntry {
  id: string;
  name: string;
  description: string;
  skillMdPath: string;
  includedSkillIds: string[];
  defaultReferencePaths: string[];
  optionalReferencePaths: string[];
  defaultAssetPaths: string[];
  outputModes: SkillOutputMode[];
}

export interface SkillManifest {
  version: number;
  skills: SkillManifestEntry[];
}

export interface ResolvedSkillResource {
  skillId: string;
  skillName: string;
  kind: SkillResourceKind;
  path: string;
  content: string;
  included: boolean;
}

export interface ResolvedSkills {
  bindings: PromptSkillBinding[];
  skills: SkillManifestEntry[];
  resources: ResolvedSkillResource[];
  warnings: string[];
}
