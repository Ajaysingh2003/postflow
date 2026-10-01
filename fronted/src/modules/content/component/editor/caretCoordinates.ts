// Calculates the pixel coordinates of the caret inside an HTMLTextAreaElement
// Mirrors the textarea typography and styling to calculate exact (top, left, height).

const properties = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "MozTabSize",
] as const;

export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number,
): CaretCoordinates {
  if (typeof window === "undefined") {
    return { top: 0, left: 0, height: 20 };
  }

  // Create mirror div
  const div = document.createElement("div");
  div.id = "input-textarea-caret-position-mirror-div";
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  // Position offscreen
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0px";
  style.left = "-9999px";

  // Transfer textarea styles to mirror div
  for (const prop of properties) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style[prop as any] = computed[prop as any];
  }

  style.overflow = "hidden";

  div.textContent = element.value.substring(0, position);

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  div.appendChild(span);

  const coordinates: CaretCoordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth || "0", 10),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth || "0", 10),
    height: parseInt(computed.lineHeight || "20", 10) || 20,
  };

  document.body.removeChild(div);

  return coordinates;
}
