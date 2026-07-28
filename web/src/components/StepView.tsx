import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredStep } from "@guide-recorder/shared";
import { screenshotUrl } from "../api";

/**
 * One step: screenshot with a bounding-box overlay + the captured context.
 *
 * The screenshot spans exactly `viewport.width` CSS px of page content, so we
 * map the CSS-px bbox onto the rendered image with scale = renderedWidth /
 * viewport.width (works regardless of devicePixelRatio). Skipped for iframe
 * clicks, where the full-tab screenshot doesn't match the frame-relative bbox.
 */
export function StepView({ step }: { step: StoredStep }) {
  const ctx = step.elementContext;
  const box = ctx.boundingBox;
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(0);

  const recomputeScale = useCallback(() => {
    const img = imgRef.current;
    if (!img || !ctx.viewport.width) return;
    setScale(img.clientWidth / ctx.viewport.width);
  }, [ctx.viewport.width]);

  useEffect(() => {
    window.addEventListener("resize", recomputeScale);
    return () => window.removeEventListener("resize", recomputeScale);
  }, [recomputeScale]);

  const showBox = scale > 0 && !ctx.inIframe;

  return (
    <div className="step">
      <div className="step-index">#{step.index + 1}</div>

      <div className="shot-wrap">
        {step.screenshotUrl ? (
          <div className="shot">
            <img
              ref={imgRef}
              src={screenshotUrl(step.screenshotUrl)}
              alt={`Steg ${step.index + 1}`}
              onLoad={recomputeScale}
            />
            {showBox && (
              <div
                className="bbox"
                style={{
                  left: box.x * scale,
                  top: box.y * scale,
                  width: box.width * scale,
                  height: box.height * scale,
                }}
              />
            )}
            {ctx.inIframe && (
              <p className="shot-note">
                iframe — bbox visas ej (screenshot är hela fliken)
              </p>
            )}
          </div>
        ) : (
          <div className="shot placeholder">
            Ingen screenshot
            {step.screenshotError ? ` (${step.screenshotError})` : ""}
          </div>
        )}
      </div>

      <dl className="ctx">
        <dt>Text</dt>
        <dd>{ctx.text || <em>—</em>}</dd>
        <dt>Selektor</dt>
        <dd>
          <code>{ctx.selector}</code>{" "}
          <span className="tag">{ctx.selectorStrategy}</span>
        </dd>
        <dt>URL-mönster</dt>
        <dd>
          <code>{ctx.urlPattern}</code>
        </dd>
        <dt>Bounding box</dt>
        <dd>
          {Math.round(box.x)}, {Math.round(box.y)} · {Math.round(box.width)}×
          {Math.round(box.height)}
        </dd>
        <dt>Flaggor</dt>
        <dd>
          {ctx.inShadowDom && <span className="tag">shadow-dom</span>}{" "}
          {ctx.inIframe && <span className="tag">iframe</span>}
          {!ctx.inShadowDom && !ctx.inIframe && "—"}
        </dd>
      </dl>
    </div>
  );
}
