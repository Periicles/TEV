import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { languages } from "./config";

const catalogs: Record<(typeof languages)[number], object> = { fr, en };

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null
      ? keys(child, `${prefix}${key}.`)
      : `${prefix}${key}`,
  );
}

describe("message catalogs", () => {
  it.each(languages)("%s has exactly the same keys as the French reference", (language) => {
    expect(keys(catalogs[language]).sort()).toEqual(keys(fr).sort());
  });
});
