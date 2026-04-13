import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const TEMPLATE_CACHE = new Map<string, string>();

const DEFAULT_TEMPLATE_DIR = join(process.cwd(), 'dist', 'skill_templates');

/**
 * Loads a skill template file by name, caching the result in memory.
 *
 * @precondition A file named `<name>.eta` must exist in the skill_templates directory.
 * @postcondition The template content is returned and cached for future calls.
 * @param name - The skill name (maps to `<name>.eta`).
 * @param templateDir - Override the template directory (used in tests).
 * @returns The template file content as a string.
 * @throws If the template file does not exist.
 */
export async function loadSkillTemplate(
  name: string,
  templateDir?: string,
): Promise<string> {
  const cached = TEMPLATE_CACHE.get(name);
  if (cached) return cached;

  const dir = templateDir ?? DEFAULT_TEMPLATE_DIR;
  const path = join(dir, `${name}.eta`);
  let content: string;
  try {
    content = await readFile(path, 'utf-8');
  } catch (err: any) {
    throw new Error(`Failed to load skill template "${name}" from ${path}: ${err.message}`);
  }
  TEMPLATE_CACHE.set(name, content);
  return content;
}

/**
 * Clears the template cache. Used in tests only.
 */
export function clearTemplateCache(): void {
  TEMPLATE_CACHE.clear();
}
