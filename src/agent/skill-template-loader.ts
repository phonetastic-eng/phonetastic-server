import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const cache = new Map<string, string>();

/**
 * Loads a skill template file by name, caching the result in memory.
 *
 * @precondition A file named `<name>.eta` must exist in `src/skill_templates/`.
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
  const cached = cache.get(name);
  if (cached) return cached;

  const dir = templateDir ?? join(process.cwd(), 'src', 'skill_templates');
  const path = join(dir, `${name}.eta`);
  const content = await readFile(path, 'utf-8');
  cache.set(name, content);
  return content;
}

/**
 * Clears the template cache. Used in tests only.
 */
export function clearTemplateCache(): void {
  cache.clear();
}
