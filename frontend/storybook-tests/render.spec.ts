import { expect, type Locator, test } from "@playwright/test";
import { measureContrast } from "./contrast";

test("タブは明暗テーマ・狭い幅でも選択でき、フォーカスと下線を表示する", async ({
  page,
}, testInfo) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 640 });
    for (const variant of ["primary", "secondary"]) {
      await page.goto(`/iframe.html?id=shared-ui-tabs--${variant}&viewMode=story`);
      const first = page.getByRole("tab", { name: "概要" });
      await expect(first).toHaveAttribute("aria-selected", "true");
      await expect(first).toHaveCSS("border-top-width", "0px");
      await expect(page.getByRole("tablist")).toHaveCSS("border-bottom-width", "1px");
      await first.focus();
      await expect(first).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("ArrowRight");
      const second = page.getByRole("tab", { name: "詳細" });
      await expect(second).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel", { name: "詳細" })).toBeVisible();
      const indicator = variant === "primary" ? second.locator("span") : second;
      expect(await indicator.evaluate((el) => getComputedStyle(el, "::after").height)).toBe(
        variant === "primary" ? "3px" : "2px",
      );
      await page.screenshot({ path: testInfo.outputPath(`tabs-${variant}-${colorScheme}.png`) });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
    await page.goto("/iframe.html?id=shared-ui-tabs--scrollable&viewMode=story");
    const list = page.getByRole("tablist");
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("すべてのストーリーを描画でき、StyleXのスタイルが適用される", async ({ page, request }) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBeTruthy();
  const index = (await response.json()) as {
    entries: Record<string, { id: string; type: string }>;
  };
  const stories = Object.values(index.entries).filter((entry) => entry.type === "story");
  expect(stories.length).toBeGreaterThan(0);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const story of stories) {
    await test.step(story.id, async () => {
      await page.goto(`/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`);
      const root = page.locator("#storybook-root");
      await expect(root).toBeVisible();
      const firstChild = root.locator(":scope > *").first();
      await expect(firstChild).toBeVisible();
      await expect(firstChild).toHaveAttribute("class", /\S+/);
      await expect(page.locator("body")).not.toContainText("Unexpected 'stylex.");
      expect(errors).toEqual([]);
    });
  }

  await page.goto("/iframe.html?id=shared-ui-badge--success&viewMode=story");
  await expect(page.locator("#storybook-root span")).toHaveCSS("display", "inline-flex");
});

test("ボタン比較に全バリアント・サイズ・無効状態があり、キーボードフォーカスを表示する", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=shared-ui-button--variants&viewMode=story");
  const table = page.getByRole("table", { name: "ボタンのバリアントと状態の比較" });
  await expect(table).toBeVisible();
  for (const name of ["Elevated", "Filled", "Tonal", "Outlined", "Text"]) {
    await expect(table.getByRole("button", { name, exact: true })).toHaveCount(3);
    await expect(table.getByRole("button", { name, exact: true }).last()).toBeDisabled();
  }
  await page.keyboard.press("Tab");
  const button = table.getByRole("button", { name: "Filled", exact: true }).first();
  await button.focus();
  await expect(button).toHaveCSS("outline-style", "solid");
  await expect(button).toBeEnabled();
});

test("TextField・Switch・Checkbox・Select・Dialogが明暗テーマと狭い幅で正しく動作しフォーカスを表示する", async ({
  page,
}, testInfo) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 640 });

    await page.goto("/iframe.html?id=shared-ui-textfield--invalid&viewMode=story");
    const input = page.getByRole("textbox", { name: /連絡先メールアドレス/ });
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await input.focus();
    await expect(page.getByText("正しい形式のメールアドレスを入力してください。")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    await page.goto("/iframe.html?id=shared-ui-switch--off&viewMode=story");
    const switchEl = page.getByRole("switch", { name: "自動保存" });
    await switchEl.focus();
    await expect(switchEl).toHaveCSS("outline-style", "solid");
    await switchEl.click();
    await expect(switchEl).toHaveAttribute("aria-checked", "true");

    await page.goto("/iframe.html?id=shared-ui-checkbox--indeterminate&viewMode=story");
    const checkbox = page.getByRole("checkbox", { name: "すべての項目を選択" });
    await expect(checkbox).toHaveAttribute("aria-checked", "mixed");
    await checkbox.focus();
    await expect(checkbox).toHaveCSS("outline-style", "solid");
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("aria-checked", "true");

    await page.goto("/iframe.html?id=shared-ui-select--outlined&viewMode=story");
    const combobox = page.getByRole("combobox", { name: /カテゴリ/ });
    await combobox.focus();
    await expect(combobox).toHaveCSS("outline-style", "solid");
    await combobox.click();
    await page.getByRole("option", { name: "開発" }).click();
    await expect(combobox).toHaveText(/開発/);

    await page.goto("/iframe.html?id=shared-ui-dialog--basic&viewMode=story");
    const trigger = page.getByRole("button", { name: "編集を終了" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "編集を終了しますか？" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("border-top-width", "1px");
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`dialog-${colorScheme}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.goto("/iframe.html?id=shared-ui-radiogroup--basic&viewMode=story");
    const radio = page.getByRole("radio", { name: /即時処理/ });
    await expect(radio).toHaveAttribute("aria-checked", "true");
    await expect(radio.locator("span").first()).toHaveCSS("transition-duration", "0s");
    await radio.focus();
    await expect(radio).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /一括処理/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("DialogはLTR・RTLの狭い画面でも中央に収まる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const dir of ["ltr", "rtl"] as const) {
    for (const width of [320, 390] as const) {
      await page.setViewportSize({ width, height: 640 });
      await page.goto("/iframe.html?id=shared-ui-dialog--basic&viewMode=story");
      await page.evaluate((direction) => {
        document.documentElement.dir = direction;
      }, dir);

      const trigger = page.getByRole("button", { name: "編集を終了" });
      await trigger.click();

      const dialog = page.getByRole("dialog", { name: "編集を終了しますか？" });
      await expect(dialog).toBeVisible();

      const { left, right } = await dialog.evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        return { left: bounds.left, right: bounds.right };
      });
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
      expect(Math.abs(left - (width - right))).toBeLessThanOrEqual(2);
    }
  }
});

test("DialogはTabを両方向に循環させ、Escapeでトリガーに戻る", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 640 });

  for (const direction of ["ltr", "rtl"] as const) {
    await test.step(direction, async () => {
      await page.goto("/iframe.html?id=shared-ui-dialog--basic&viewMode=story");
      await page.evaluate((dir) => {
        document.documentElement.dir = dir;
      }, direction);
      const trigger = page.getByRole("button", { name: "編集を終了", exact: true });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "編集を終了しますか？" });
      const close = dialog.getByRole("button", { name: "閉じる", exact: true });
      const cancel = dialog.getByRole("button", { name: "キャンセル" });
      const confirm = dialog.getByRole("button", { name: "終了して保存" });
      await expect(close).toBeFocused();

      for (const target of [cancel, confirm, close]) {
        await page.keyboard.press("Tab");
        await expect(target).toBeFocused();
      }

      for (const target of [confirm, cancel, close]) {
        await page.keyboard.press("Shift+Tab");
        await expect(target).toBeFocused();
      }

      await page.keyboard.press("Escape");

      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
});

test("Dialogは200%文字拡大時も確定ボタンで閉じられる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/iframe.html?id=shared-ui-dialog--scrollable-body&viewMode=story");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  const dialog = page.getByRole("dialog", { name: "利用規約の確認" });
  await expect(dialog).toBeVisible();
  const confirmButton = dialog.getByRole("button", { name: "終了して保存" });

  await confirmButton.click();

  await expect(dialog).toBeHidden();
});

function measureSwitchThumb(control: Locator) {
  return control.evaluate((track) => {
    const thumb = track.querySelector('[data-slot="switch-thumb"]');
    if (!thumb) throw new Error("Switch のつまみが見つかりません");
    const trackBox = track.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();
    const leftGap = thumbBox.left - trackBox.left;
    const rightGap = trackBox.right - thumbBox.right;

    return {
      inlineStart: getComputedStyle(track).direction === "rtl" ? rightGap : leftGap,
      left: leftGap,
      right: rightGap,
      top: thumbBox.top - trackBox.top,
      bottom: trackBox.bottom - thumbBox.bottom,
    };
  });
}

test("SwitchがLTR・RTLで鏡像配置され、全状態でつまみがトラック内に収まる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 640 });

  for (const story of ["off", "on", "disabled-off", "disabled-on"] as const) {
    const offsets: number[] = [];

    for (const dir of ["ltr", "rtl"] as const) {
      await page.goto(`/iframe.html?id=shared-ui-switch--${story}&viewMode=story`);
      await page.evaluate((direction) => {
        document.documentElement.dir = direction;
      }, dir);

      const sw = page.getByRole("switch", { name: "自動保存" });
      const thumb = sw.locator('[data-slot="switch-thumb"]');
      await expect(sw).toHaveAttribute("aria-checked", String(story.endsWith("on")));
      await expect(thumb).toBeVisible();
      await expect(thumb).toHaveCSS("transition-duration", "0s");

      const position = await measureSwitchThumb(sw);

      // 境界線2pxの内側に収まっていることを確認する。
      expect(
        Math.min(position.left, position.right, position.top, position.bottom),
      ).toBeGreaterThanOrEqual(2);
      offsets.push(position.inlineStart);
    }

    const [ltrOffset, rtlOffset] = offsets;
    expect(Math.abs(ltrOffset - rtlOffset)).toBeLessThanOrEqual(1);
  }
});

test("SwitchのつまみはSpaceキーとラベル操作でLTR・RTLの両方向に移動する", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 640 });

  for (const direction of ["ltr", "rtl"] as const) {
    await test.step(direction, async () => {
      await page.goto("/iframe.html?id=shared-ui-switch--off&viewMode=story");
      await page.evaluate((dir) => {
        document.documentElement.dir = dir;
      }, direction);
      const control = page.getByRole("switch", { name: "自動保存" });
      await expect(control).toHaveAttribute("aria-checked", "false");
      const uncheckedOffset = (await measureSwitchThumb(control)).inlineStart;

      await control.press("Space");

      await expect(control).toHaveAttribute("aria-checked", "true");
      expect((await measureSwitchThumb(control)).inlineStart).toBeGreaterThan(uncheckedOffset);

      await page.getByText("自動保存", { exact: true }).click();

      await expect(control).toHaveAttribute("aria-checked", "false");
      const restoredOffset = (await measureSwitchThumb(control)).inlineStart;
      expect(Math.abs(restoredOffset - uncheckedOffset)).toBeLessThanOrEqual(1);
    });
  }
});

test("動的StyleXオーバーライドが対象部位の幅に反映される", async ({ page }) => {
  await page.goto("/iframe.html?id=shared-ui-checkbox--dynamic-width-standalone&viewMode=story");
  const standaloneCb = page.getByRole("checkbox", { name: "幅指定チェックボックス" });
  await expect(standaloneCb).toHaveCSS("width", "280px");

  await page.goto("/iframe.html?id=shared-ui-checkbox--dynamic-width-field&viewMode=story");
  await expect(page.locator('[data-slot="field"]')).toHaveCSS("width", "280px");

  await page.goto("/iframe.html?id=shared-ui-switch--dynamic-width-standalone&viewMode=story");
  const standaloneSw = page.getByRole("switch", { name: "幅指定スイッチ" });
  await expect(standaloneSw).toHaveCSS("width", "104px");

  await page.goto("/iframe.html?id=shared-ui-switch--dynamic-width-field&viewMode=story");
  await expect(page.locator('[data-slot="field"]')).toHaveCSS("width", "280px");

  await page.goto("/iframe.html?id=shared-ui-dialog--dynamic-width&viewMode=story");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("width", "300px");
});

test("CSSレイヤーでは通常宣言のresetがui-sdkより優先され、hiddenは非表示になる", async ({
  page,
}) => {
  await page.goto("/iframe.html?id=shared-ui-dialog--dynamic-width&viewMode=story");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.dataset.testid = "layer-order-probe";
    probe.dataset.slot = "layer-order-probe";
    probe.hidden = true;
    document.body.append(probe);
  });

  // 先にresetを書き、アプリ側のレイヤー順がない場合に期待値を満たさないようにする。
  await page.addStyleTag({
    content: `
      @layer reset { [data-testid="layer-order-probe"] { color: rgb(0, 128, 0); display: block; } }
      @layer ui-sdk { [data-testid="layer-order-probe"] { color: rgb(255, 0, 0); } }
    `,
  });

  const probe = page.getByTestId("layer-order-probe");
  await expect(probe).toHaveCSS("color", "rgb(0, 128, 0)");
  await expect(probe).toHaveCSS("display", "none");
});

test("Switchのつまみとトラックを明暗テーマの通常・ホバー状態で見分けられる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const story of ["off", "on"] as const) {
      await test.step(`${colorScheme} / ${story}`, async () => {
        await page.goto(`/iframe.html?id=shared-ui-switch--${story}&viewMode=story`);
        await page.mouse.move(0, 0);
        const control = page.getByRole("switch", { name: "自動保存" });
        await expect(control.locator('[data-slot="switch-thumb"]')).toBeVisible();
        const normalContrast = await control.evaluate(measureContrast, "switch-thumb" as const);

        await control.hover();

        const hoveredContrast = await control.evaluate(measureContrast, "switch-thumb" as const);
        expect(normalContrast, "通常状態のコントラスト").toBeGreaterThanOrEqual(3);
        expect(hoveredContrast, "ホバー状態のコントラスト").toBeGreaterThanOrEqual(3);
      });
    }
  }
});

test("ButtonとBadgeの文字は明暗テーマで背景と十分に区別できる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/iframe.html?id=shared-ui-button--variants&viewMode=story");

    for (const name of ["Elevated", "Filled", "Tonal", "Outlined", "Text"]) {
      await test.step(`${colorScheme} / Button ${name}`, async () => {
        await page.mouse.move(0, 0);
        const button = page.getByRole("button", { name, exact: true }).first();
        await expect(button).toBeVisible();
        const normalContrast = await button.evaluate(measureContrast, "text" as const);

        await button.hover();

        const hoveredContrast = await button.evaluate(measureContrast, "text" as const);
        expect(normalContrast, "通常状態のコントラスト").toBeGreaterThanOrEqual(4.5);
        expect(hoveredContrast, "ホバー状態のコントラスト").toBeGreaterThanOrEqual(4.5);
      });
    }

    for (const tone of ["neutral", "success", "danger"] as const) {
      await test.step(`${colorScheme} / Badge ${tone}`, async () => {
        await page.goto(`/iframe.html?id=shared-ui-badge--${tone}&viewMode=story`);
        const badge = page.locator("#storybook-root span");
        await expect(badge).toBeVisible();

        const contrast = await badge.evaluate(measureContrast, "text" as const);

        expect(contrast).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

test("フォーム部品は明暗テーマの200%文字拡大時も横にはみ出さない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const storyId of [
      "shared-ui-textfield--with-affix",
      "shared-ui-select--outlined",
      "shared-ui-radiogroup--basic",
      "shared-ui-checkbox--checked",
    ]) {
      await test.step(`${colorScheme} / ${storyId}`, async () => {
        await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
        await expect(page.locator("#storybook-root > *").first()).toBeVisible();

        await page.evaluate(() => {
          document.documentElement.style.fontSize = "32px";
        });

        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });
    }
  }
});

test("Alert は明暗テーマで十分なコントラストを持ち、閉じる操作と狭幅表示が破綻しない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const spec of [
      {
        storyId: "shared-ui-alert--info",
        title: "設定の案内",
        message: "変更内容は保存ボタンを押した後に反映されます。",
        expectedRole: "status" as const,
      },
      {
        storyId: "shared-ui-alert--success",
        title: "保存しました",
        message: "プロジェクト設定の更新が完了しました。",
        expectedRole: "status" as const,
      },
      {
        storyId: "shared-ui-alert--warning",
        title: "接続が不安定です",
        message: "再試行するか、ネットワーク設定を確認してください。",
        expectedRole: "alert" as const,
      },
      {
        storyId: "shared-ui-alert--error-tone",
        title: "保存に失敗しました",
        message: "入力内容を確認し、時間をおいて再度お試しください。",
        expectedRole: "alert" as const,
      },
    ]) {
      await test.step(`${colorScheme} / ${spec.storyId}`, async () => {
        await page.goto(`/iframe.html?id=${spec.storyId}&viewMode=story`);
        await expect(page.getByRole(spec.expectedRole)).toBeVisible();

        const titleContrast = await page
          .getByText(spec.title)
          .evaluate(measureContrast, "text" as const);
        const messageContrast = await page
          .getByText(spec.message)
          .evaluate(measureContrast, "text" as const);
        expect(titleContrast).toBeGreaterThanOrEqual(4.5);
        expect(messageContrast).toBeGreaterThanOrEqual(4.5);

        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });
    }
  }

  await page.goto("/iframe.html?id=shared-ui-alert--dismissible&viewMode=story");
  await expect(page.getByText("アップデートがあります")).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByText("アップデートがあります")).toBeHidden();
  await expect(page.getByRole("button", { name: "通知を再表示" })).toBeVisible();
});

test("Toast は明暗テーマ・LTR/RTL で十分なコントラストと表示・閉じる操作を保つ", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const spec of [
      {
        storyId: "shared-ui-toast--default-tone",
        title: "設定を下書き保存しました",
        description: "準備ができたら公開してください。",
      },
      {
        storyId: "shared-ui-toast--success-tone",
        title: "設定を保存しました",
        description: "すべての変更が反映されています。",
      },
      {
        storyId: "shared-ui-toast--error-tone",
        title: "通信エラーが発生しました",
        description: "サーバーへ接続できませんでした。",
      },
    ]) {
      await test.step(`${colorScheme} / ${spec.storyId}`, async () => {
        await page.goto(`/iframe.html?id=${spec.storyId}&viewMode=story`);
        const titleLocator = page.getByText(spec.title);
        const descLocator = page.getByText(spec.description);
        await expect(titleLocator).toBeVisible();
        await expect(descLocator).toBeVisible();

        expect(
          await titleLocator.evaluate(measureContrast, "text" as const),
        ).toBeGreaterThanOrEqual(4.5);
        expect(await descLocator.evaluate(measureContrast, "text" as const)).toBeGreaterThanOrEqual(
          4.5,
        );
      });
    }

    await page.goto("/iframe.html?id=shared-ui-toast--default-tone&viewMode=story");
    const actionButton = page.getByRole("button", { name: "再実行" });
    const closeButton = page.getByRole("button", { name: "通知を閉じる" });
    await expect(actionButton).toBeVisible();
    const actionContrast = await actionButton.evaluate(measureContrast, "text" as const);
    expect(actionContrast).toBeGreaterThanOrEqual(4.5);

    const inverseTextColor = await page
      .getByText("設定を下書き保存しました")
      .evaluate((el) => getComputedStyle(el).color);
    await page.keyboard.press("Tab");
    await expect(page.locator('[data-slot="toast"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(actionButton).toBeFocused();
    expect(await actionButton.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(
      inverseTextColor,
    );
    await page.keyboard.press("Tab");
    await expect(closeButton).toBeFocused();
    expect(await closeButton.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(
      inverseTextColor,
    );
  }

  for (const dir of ["ltr", "rtl"] as const) {
    await test.step(`${dir} interactive`, async () => {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto("/iframe.html?id=shared-ui-toast--interactive&viewMode=story");
      await page.evaluate((nextDir) => {
        document.documentElement.dir = nextDir;
      }, dir);

      await page.getByRole("button", { name: "通常通知を表示" }).click();
      const region = page.getByRole("region", { name: "通知" });
      await expect(region).toBeVisible();
      await expect(page.getByText("下書きを保存しました")).toBeVisible();

      const regionBox = await region.boundingBox();
      expect(regionBox).not.toBeNull();
      expect(regionBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (regionBox?.x ?? Number.POSITIVE_INFINITY) + (regionBox?.width ?? 0),
      ).toBeLessThanOrEqual(390);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      await page.getByRole("button", { name: "成功通知を表示" }).click();
      await expect(page.getByText("更新が完了しました")).toBeVisible();
      const listLayout = await region.locator('ol[data-slot="toast-list"]').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          rowGap: style.rowGap,
          count: el.children.length,
        };
      });
      expect(listLayout.display).toBe("flex");
      expect(listLayout.flexDirection).toBe("column-reverse");
      expect(Number.parseFloat(listLayout.rowGap)).toBeGreaterThan(0);
      expect(listLayout.count).toBe(2);

      await page.getByRole("button", { name: "通知を閉じる" }).first().click();
      await page.getByRole("button", { name: "通知を閉じる" }).first().click();
      await expect(page.getByText("下書きを保存しました")).toBeHidden();
      await expect(page.getByText("更新が完了しました")).toBeHidden();

      await page.getByRole("button", { name: "エラー通知を表示" }).click();
      await expect(page.getByText("送信に失敗しました")).toBeVisible();
      await page.getByRole("button", { name: "通知を閉じる" }).focus();
      await page.keyboard.press("Escape");
      await expect(page.getByText("送信に失敗しました")).toBeHidden();
    });
  }
});

test("Spinner と Skeleton は視認可能で、reduced-motion 設定時に Spinner は低速化し Skeleton は停止する", async ({
  page,
}) => {
  const readMotion = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((el) => {
      const style = getComputedStyle(el);
      return { animationDuration: style.animationDuration, animationName: style.animationName };
    });

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/iframe.html?id=shared-ui-spinner--medium&viewMode=story");
  await expect(page.getByRole("status")).toBeVisible();
  const spinnerCircle = page.locator('[role="status"] > span[aria-hidden="true"]').first();
  const spinnerDefaultMotion = await readMotion(spinnerCircle);
  expect(spinnerDefaultMotion.animationDuration).toBe("0.9s");
  expect(spinnerDefaultMotion.animationName).not.toBe("none");

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const spinnerReducedMotion = await readMotion(spinnerCircle);
  expect(spinnerReducedMotion.animationDuration).toBe("6s");
  expect(spinnerReducedMotion.animationName).not.toBe("none");

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/iframe.html?id=shared-ui-spinner--large&viewMode=story");
    const labelContrast = await page
      .getByText("データを取得しています…")
      .evaluate(measureContrast, "text" as const);
    expect(labelContrast).toBeGreaterThanOrEqual(4.5);
  }

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/iframe.html?id=shared-ui-skeleton--text-lines&viewMode=story");
  const firstLine = page.locator('#storybook-root [aria-hidden="true"] span').first();
  await expect(firstLine).toBeVisible();
  const skeletonDefaultMotion = await readMotion(firstLine);
  expect(skeletonDefaultMotion.animationDuration).toBe("1.4s");
  expect(skeletonDefaultMotion.animationName).not.toBe("none");

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  expect(await readMotion(firstLine)).toEqual({
    animationDuration: "0s",
    animationName: "none",
  });
});

test("Textarea は明暗テーマで十分なコントラストを持ち、invalid 状態と200%文字拡大でも破綻しない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

    for (const storyId of ["shared-ui-textarea--outlined", "shared-ui-textarea--filled"]) {
      await test.step(`${colorScheme} / ${storyId}`, async () => {
        await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
        const textarea = page.getByRole("textbox");
        await expect(textarea).toBeVisible();
        expect(await textarea.evaluate(measureContrast, "text" as const)).toBeGreaterThanOrEqual(
          4.5,
        );

        await page.evaluate(() => {
          document.documentElement.style.fontSize = "32px";
        });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
      });
    }

    await page.goto("/iframe.html?id=shared-ui-textarea--invalid&viewMode=story");
    const invalidTextarea = page.getByRole("textbox", { name: /詳細説明/ });
    await expect(invalidTextarea).toHaveAttribute("aria-invalid", "true");
    const errorLocator = page.getByText("20文字以上で入力してください。");
    await expect(errorLocator).toBeVisible();
    expect(await errorLocator.evaluate(measureContrast, "text" as const)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

test("Menu はキーボード・Escape・Disabled 抑止・LTR/RTL 収まり・明暗コントラストを満たす", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/iframe.html?id=shared-ui-menu--default-open&viewMode=story");
    await expect(page.getByRole("menu")).toBeVisible();

    expect(
      await page.getByRole("menuitem", { name: /編集/ }).evaluate(measureContrast, "text" as const),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      await page.getByRole("menuitem", { name: "削除" }).evaluate(measureContrast, "text" as const),
    ).toBeGreaterThanOrEqual(4.5);
  }

  await page.setViewportSize({ width: 320, height: 640 });
  for (const dir of ["ltr", "rtl"] as const) {
    await test.step(`${dir}`, async () => {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto("/iframe.html?id=shared-ui-menu--basic&viewMode=story");
      await page.evaluate((nextDir) => {
        document.documentElement.dir = nextDir;
      }, dir);

      const trigger = page.getByRole("button", { name: "操作メニュー" });
      await trigger.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();

      const menuBox = await menu.boundingBox();
      expect(menuBox).not.toBeNull();
      expect(menuBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect((menuBox?.x ?? Number.POSITIVE_INFINITY) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(
        320,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menuitem", { name: /編集/ })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menuitem", { name: "複製" })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      const disabledItem = page.getByRole("menuitem", { name: "アーカイブ（無効）" });
      await expect(disabledItem).toBeFocused();
      await expect(disabledItem).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Enter");
      await expect(menu).toBeVisible();

      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
});

test("Tooltip はキーボードフォーカス・Escape・トグル・LTR/RTL・明暗コントラストを満たす", async ({
  page,
}) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/iframe.html?id=shared-ui-tooltip--default-open&viewMode=story");
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    expect(await tooltip.evaluate(measureContrast, "text" as const)).toBeGreaterThanOrEqual(4.5);
  }

  await page.setViewportSize({ width: 390, height: 640 });
  for (const dir of ["ltr", "rtl"] as const) {
    await test.step(`${dir}`, async () => {
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto("/iframe.html?id=shared-ui-tooltip--basic&viewMode=story");
      await page.evaluate((nextDir) => {
        document.documentElement.dir = nextDir;
      }, dir);

      const trigger = page.getByRole("button", { name: "保存" });
      await expect(trigger).toBeVisible();
      await page.keyboard.press("Tab");
      await expect(trigger).toBeFocused();

      const tooltip = page.getByRole("tooltip");
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText("変更内容を保存します");

      const tooltipBox = await tooltip.boundingBox();
      expect(tooltipBox).not.toBeNull();
      expect(tooltipBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (tooltipBox?.x ?? Number.POSITIVE_INFINITY) + (tooltipBox?.width ?? 0),
      ).toBeLessThanOrEqual(390);

      await page.keyboard.press("Escape");
      await expect(tooltip).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/iframe.html?id=shared-ui-tooltip--basic&viewMode=story");
  const hoverTrigger = page.getByRole("button", { name: "保存" });
  await expect(hoverTrigger).toBeVisible();
  await hoverTrigger.hover();
  const hoverTooltip = page.getByRole("tooltip");
  await expect(hoverTooltip).toBeVisible();
  await hoverTooltip.hover();
  await expect(hoverTooltip).toBeVisible();

  await page.goto("/iframe.html?id=shared-ui-tooltip--toggleable-info&viewMode=story");
  const toggleTrigger = page.getByRole("button", { name: "補足情報を表示" });
  await toggleTrigger.click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await toggleTrigger.click();
  await expect(page.getByRole("tooltip")).toBeHidden();
});
