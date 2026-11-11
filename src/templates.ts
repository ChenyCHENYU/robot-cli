import type {
  TemplateConfig,
  CategoryConfig,
} from "./types";
import {
  TEMPLATE_CATEGORIES,
  RECOMMENDED_TEMPLATE_KEYS,
} from "./config";

export { TEMPLATE_CATEGORIES };

// ── Helpers ──────────────────────────────────────────────────────

export function getAllTemplates(): Record<string, TemplateConfig> {
  const templates: Record<string, TemplateConfig> = {};

  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        Object.assign(templates, pattern.templates);
      }
    }
  }

  return templates;
}

/** Only templates that can actually be created belong in the default catalogue. */
export function getAvailableTemplates(): Record<string, TemplateConfig> {
  return Object.fromEntries(
    Object.entries(getAllTemplates()).filter(([, template]) => template.status !== "coming-soon"),
  );
}

export function getTemplatesByCategory(
  categoryKey: string,
  stackKey: string,
  patternKey: string,
): Record<string, TemplateConfig> {
  const category = TEMPLATE_CATEGORIES[categoryKey];
  if (!category) return {};
  const stack = category.stacks[stackKey];
  if (!stack) return {};
  const pattern = stack.patterns[patternKey];
  if (!pattern) return {};
  return pattern.templates;
}

export function searchTemplates(
  keyword: string,
  options: { includePlanned?: boolean } = {},
): Record<string, TemplateConfig> {
  const all = options.includePlanned ? getAllTemplates() : getAvailableTemplates();
  const results: Record<string, TemplateConfig> = {};
  const lower = keyword.trim().toLowerCase();
  if (!lower) return results;

  for (const [key, t] of Object.entries(all)) {
    const haystack =
      `${key} ${t.name} ${t.description} ${t.features.join(" ")}`.toLowerCase();
    if (haystack.includes(lower)) {
      results[key] = t;
    }
  }
  return results;
}

export function getRecommendedTemplates(): Record<string, TemplateConfig> {
  const all = getAllTemplates();
  const recommended: Record<string, TemplateConfig> = {};
  const keys = RECOMMENDED_TEMPLATE_KEYS;

  for (const key of keys) {
    if (all[key] && !all[key].status && !all[key].advanced) recommended[key] = all[key];
  }

  return recommended;
}

export function getCategoryForTemplate(
  templateKey: string,
): CategoryConfig | undefined {
  for (const category of Object.values(TEMPLATE_CATEGORIES)) {
    for (const stack of Object.values(category.stacks)) {
      for (const pattern of Object.values(stack.patterns)) {
        if (templateKey in pattern.templates) return category;
      }
    }
  }
  return undefined;
}
