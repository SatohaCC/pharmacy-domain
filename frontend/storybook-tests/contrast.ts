export function measureContrast(element: Element, target: "text" | "switch-thumb"): number {
  type Color = [red: number, green: number, blue: number, alpha: number];

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!canvasContext) throw new Error("コントラスト計測用の2Dコンテキストが利用できません");
  const context = canvasContext;

  const transparent: Color = [0, 0, 0, 0];
  const white: Color = [255, 255, 255, 1];

  function parseColor(css: string): Color {
    if (!CSS.supports("color", css)) throw new Error(`計測できない色: ${css}`);
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    return [red, green, blue, alpha / 255];
  }

  function composite(front: Color, back: Color): Color {
    const frontWeight = front[3];
    const backWeight = back[3] * (1 - frontWeight);
    const alpha = frontWeight + backWeight;
    if (alpha === 0) return transparent;

    return [
      (front[0] * frontWeight + back[0] * backWeight) / alpha,
      (front[1] * frontWeight + back[1] * backWeight) / alpha,
      (front[2] * frontWeight + back[2] * backWeight) / alpha,
      alpha,
    ];
  }

  function renderColor(start: Element, foreground = transparent): Color {
    let color = foreground;
    for (let node: Element | null = start; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const background = parseColor(style.backgroundColor);
      // State Layer は両端が同じ色のグラデーションで、面全体が均一色になる。
      const stateLayer = /^linear-gradient\((.+), \1\)$/.exec(style.backgroundImage)?.[1];
      if (style.backgroundImage !== "none" && !stateLayer) {
        throw new Error(`計測できない背景画像: ${style.backgroundImage}`);
      }
      const surface = stateLayer ? composite(parseColor(stateLayer), background) : background;

      // opacity は要素の背景と子孫を合成した結果にかかる。
      const [red, green, blue, alpha] = composite(color, surface);
      color = [red, green, blue, alpha * Number(style.opacity)];
    }
    return composite(color, white);
  }

  function luminance([red, green, blue]: Color) {
    const [r, g, b] = [red, green, blue].map((value) => {
      const srgb = value / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const background = luminance(renderColor(element));
  const thumb =
    target === "switch-thumb" ? element.querySelector('[data-slot="switch-thumb"]') : null;
  if (target === "switch-thumb" && !thumb) throw new Error("Switch のつまみが見つかりません");
  const foreground = luminance(
    thumb ? renderColor(thumb) : renderColor(element, parseColor(getComputedStyle(element).color)),
  );
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
}
