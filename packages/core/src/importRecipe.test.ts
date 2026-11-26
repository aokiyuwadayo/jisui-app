import { describe, expect, it } from "vitest";
import { parseDurationMinutes, parseRecipeFromHtml } from "./importRecipe";

const page = (json: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head></html>`;

describe("parseRecipeFromHtml", () => {
  it("@graph の中の Recipe を読み取る", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage", name: "ページ" },
        {
          "@type": ["Recipe"],
          name: "豚の生姜焼き &amp; キャベツ",
          image: [{ "@type": "ImageObject", url: "https://example.com/a.jpg" }],
          recipeYield: "2人分",
          totalTime: "PT20M",
          recipeIngredient: ["豚ロース 200g", "★しょうが 1かけ"],
          recipeInstructions: [
            { "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "<b>豚肉</b>に下味をつける" }] },
            { "@type": "HowToStep", text: "フライパンで焼く" },
          ],
          recipeCategory: "主菜",
          keywords: "豚肉, 定番",
        },
      ],
    });
    expect(parseRecipeFromHtml(html, "https://example.com/r/1")).toEqual({
      title: "豚の生姜焼き & キャベツ",
      sourceUrl: "https://example.com/r/1",
      imageUrl: "https://example.com/a.jpg",
      servings: 2,
      cookMinutes: 20,
      ingredients: [
        { name: "豚ロース", amount: "200g" },
        { name: "しょうが", amount: "1かけ" },
      ],
      steps: ["豚肉 に下味をつける", "フライパンで焼く"],
      equipment: ["フライパン"],
      tags: ["主菜", "豚肉", "定番"],
    });
  });

  it("壊れた JSON は飛ばし、Recipe がなければ null", () => {
    const html = `<script type="application/ld+json">{oops</script>${page({ "@type": "Article" })}`;
    expect(parseRecipeFromHtml(html, "https://example.com")).toBeNull();
  });

  it("totalTime がなければ prepTime + cookTime", () => {
    const html = page({ "@type": "Recipe", name: "x", prepTime: "PT10M", cookTime: "PT1H" });
    expect(parseRecipeFromHtml(html, "https://example.com")?.cookMinutes).toBe(70);
  });
});

describe("parseDurationMinutes", () => {
  it("ISO 8601 の期間を分にする", () => {
    expect(parseDurationMinutes("PT1H30M")).toBe(90);
    expect(parseDurationMinutes("P0DT0H15M")).toBe(15);
    expect(parseDurationMinutes("15分")).toBeUndefined();
  });
});
