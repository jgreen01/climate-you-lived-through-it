// @ts-check
const { test, expect } = require("@playwright/test");

const sceneIndex = (page) => page.evaluate(() => state.scene);

test.describe("app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // scene 1 is the map; it renders after heat.json + the basemap load
    await page.waitForSelector("#chart circle.city");
  });

  test("loads with no console errors", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.reload();
    await page.waitForSelector("#chart circle.city");
    expect(errors).toEqual([]);
  });

  test("all three vendored libraries expose their globals", async ({ page }) => {
    const globals = await page.evaluate(() => ({
      d3: typeof window.d3,
      annotation: typeof window.d3?.annotation,
      topojson: typeof window.topojson,
    }));
    expect(globals.d3).toBe("object");
    expect(globals.annotation).toBe("function");
    expect(globals.topojson).toBe("object");
  });

  test("scene 1 is the map, with smooth contours and no overlay toggle", async ({ page }) => {
    expect(await sceneIndex(page)).toBe(0);
    await expect(page.locator("circle.city").first()).toBeVisible();
    await expect(page.locator("#chart path.contour").first()).toBeVisible();
    await expect(page.locator(".overlay-toggle")).toHaveCount(0);
  });

  test("hovering a city dot shows a tooltip with its name and day delta", async ({ page }) => {
    await expect(page.locator("#map-tooltip")).toBeHidden();
    await page.locator("circle.city").first().hover();
    await expect(page.locator("#map-tooltip")).toBeVisible();
    await expect(page.locator("#map-tooltip strong")).toHaveText("Recife");
    await expect(page.locator("#map-tooltip")).toContainText("+143 days");
    await page.mouse.move(5, 5);
    await expect(page.locator("#map-tooltip")).toBeHidden();
  });

  test("city dropdown is hidden on the map but shown on other scenes", async ({ page }) => {
    await expect(page.locator("#city-select")).toBeHidden();
    await page.click("#btn-next");
    await expect(page.locator("#city-select")).toBeVisible();
  });

  test("scene 2 renders two waffles of 365 squares with correct hot counts", async ({ page }) => {
    // Featured city = Chicago, hot-days: past 14.0 -> 14 red, present 20.1 -> 20 red
    await page.click("#btn-next");
    await expect(page.locator("#waffle-pair .waffle")).toHaveCount(2);
    await expect(page.locator("#waffle-pair rect.sq")).toHaveCount(730);
    const counts = await page.evaluate(() => {
      const waffles = [...document.querySelectorAll("#waffle-pair .waffle")];
      return waffles.map((w) => w.querySelectorAll("rect.sq-hot").length);
    });
    expect(counts).toEqual([14, 20]);
  });

  test("city dropdown switches city and re-renders", async ({ page }) => {
    await page.click("#btn-next");
    await page.selectOption("#city-select", "recife");
    // Recife hot-days: past 46.3 -> 46 red, present 39.0 -> 39 red
    const counts = await page.evaluate(() => {
      const waffles = [...document.querySelectorAll("#waffle-pair .waffle")];
      return waffles.map((w) => w.querySelectorAll("rect.sq-hot").length);
    });
    expect(counts).toEqual([46, 39]);
  });

  test("scene navigation triggers work (buttons + state)", async ({ page }) => {
    expect(await sceneIndex(page)).toBe(0);
    await expect(page.locator("#btn-prev")).toBeDisabled();

    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(1);

    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(2);

    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(3);

    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(4);
    await expect(page.locator("#btn-next")).toBeEnabled();
    await expect(page.locator("#btn-next")).toHaveText("Return to map ↺");

    // the last scene loops back to the map instead of dead-ending
    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(0);
    await expect(page.locator("circle.city").first()).toBeVisible();

    await page.click("#btn-next");
    expect(await sceneIndex(page)).toBe(1);
    await page.click("#btn-prev");
    expect(await sceneIndex(page)).toBe(0);
  });

  test("Back/Next labels name the destination scene, not just 'Back'/'Next'", async ({ page }) => {
    await expect(page.locator("#btn-prev")).toHaveText("← Back");
    await expect(page.locator("#btn-next")).toContainText("Explore");
    await expect(page.locator("#btn-next")).toContainText("story →");

    await page.click("#btn-next"); // -> scene 1
    await expect(page.locator("#btn-prev")).toHaveText("← Back to the map");
    await expect(page.locator("#btn-next")).toHaveText("See the next 20 years →");

    await page.click("#btn-next"); // -> scene 2
    await expect(page.locator("#btn-prev")).toHaveText("← Back to 1980s vs. now");
    await expect(page.locator("#btn-next")).toHaveText("See the 2080 fork →");
  });


  test("breadcrumb dots show 5 scenes, mark the active one, and jump on click", async ({ page }) => {
    const dots = page.locator(".breadcrumb-dot");
    await expect(dots).toHaveCount(5);
    await expect(page.locator(".breadcrumb-active")).toHaveCount(1);
    await expect(dots.nth(0)).toHaveClass(/breadcrumb-active/);
    await expect(dots.nth(0)).toHaveAttribute("title", "Map");
    await expect(dots.nth(3)).toHaveAttribute("title", "Two 2080 futures");

    await dots.nth(3).click();
    expect(await sceneIndex(page)).toBe(3);
    await expect(dots.nth(3)).toHaveClass(/breadcrumb-active/);
    await expect(dots.nth(0)).not.toHaveClass(/breadcrumb-active/);
  });

  test("keyboard arrows navigate scenes", async ({ page }) => {
    await page.locator("body").press("ArrowRight");
    expect(await sceneIndex(page)).toBe(1);
    await page.locator("body").press("ArrowLeft");
    expect(await sceneIndex(page)).toBe(0);
  });

  test("scene 4 shows the two-futures split (farLow vs farHigh)", async ({ page }) => {
    await page.click("#btn-next");
    await page.click("#btn-next");
    await page.click("#btn-next");
    // Chicago hot-days: farLow 54.4 -> 54 red, farHigh 85.3 -> 85 red
    const counts = await page.evaluate(() => {
      const waffles = [...document.querySelectorAll("#waffle-pair .waffle")];
      return waffles.map((w) => w.querySelectorAll("rect.sq-hot").length);
    });
    expect(counts).toEqual([54, 85]);
  });

  test("every scene shows the same static measured-vs-modeled footnote", async ({ page }) => {
    for (let i = 0; i < 5; i++) {
      await expect(page.locator("#attribution")).toBeVisible();
      await expect(page.locator("#attribution")).toContainText("measured, not modeled");
      if (i < 4) await page.click("#btn-next");
    }
  });

  test("metric selector switches metric and re-renders", async ({ page }) => {
    await page.click("#btn-next"); // off the map, onto a waffle scene
    await expect(page.locator("#metric-bar button")).toHaveCount(4);
    await page.click("#metric-bar button:has-text('Freezing days')");
    await expect(page.locator("#scene-subtitle")).toContainText("days below 0");
  });

  test("map: clicking a city dot drills into that city's scene 2", async ({ page }) => {
    expect(await sceneIndex(page)).toBe(0);
    await expect(page.locator("circle.city").first()).toBeVisible();

    await page.locator("circle.city").first().click();
    expect(await sceneIndex(page)).toBe(1);
    await expect(page.locator("#waffle-pair .waffle")).toHaveCount(2);
  });
});
