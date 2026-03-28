import { describe, it, expect } from "vitest";
import {
  getAllTemplates,
  searchTemplates,
  getRecommendedTemplates,
} from "../src/templates";

describe("getAllTemplates", () => {
  it("should return a non-empty object of templates", () => {
    const all = getAllTemplates();
    expect(Object.keys(all).length).toBeGreaterThan(0);
  });

  it("should contain known template keys", () => {
    const all = getAllTemplates();
    expect(all).toHaveProperty("robot-admin");
    expect(all).toHaveProperty("robot-react");
    expect(all).toHaveProperty("robot-nest");
  });

  it("each template should have required fields", () => {
    const all = getAllTemplates();
    for (const [, t] of Object.entries(all)) {
      expect(t).toHaveProperty("name");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("repoUrl");
      expect(t).toHaveProperty("features");
      expect(t).toHaveProperty("version");
      expect(Array.isArray(t.features)).toBe(true);
      expect(["full", "base", "micro"]).toContain(t.version);
    }
  });
});

describe("searchTemplates", () => {
  it("should find templates by name keyword", () => {
    const results = searchTemplates("vue");
    expect(Object.keys(results).length).toBeGreaterThan(0);
  });

  it("should find templates by feature keyword", () => {
    const results = searchTemplates("JWT");
    expect(Object.keys(results).length).toBeGreaterThan(0);
  });

  it("should return empty for non-matching keyword", () => {
    const results = searchTemplates("zzz_nonexistent_zzz");
    expect(Object.keys(results).length).toBe(0);
  });

  it("should be case insensitive", () => {
    const lower = searchTemplates("vue");
    const upper = searchTemplates("VUE");
    expect(Object.keys(lower)).toEqual(Object.keys(upper));
  });
});

describe("getRecommendedTemplates", () => {
  it("should return a subset of all templates", () => {
    const rec = getRecommendedTemplates();
    const all = getAllTemplates();
    expect(Object.keys(rec).length).toBeLessThanOrEqual(
      Object.keys(all).length,
    );
    expect(Object.keys(rec).length).toBeGreaterThan(0);
  });

  it("each recommended template should exist in all templates", () => {
    const rec = getRecommendedTemplates();
    const all = getAllTemplates();
    for (const key of Object.keys(rec)) {
      expect(all).toHaveProperty(key);
    }
  });
});
