"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { Cursor, RoomProvider } from "@/lib/provider";

type Tool = "pen" | "rectangle" | "ellipse" | "line" | "eraser";
type Point = { x: number; y: number };
type Shape = { id: string; type: Exclude<Tool, "eraser">; points: Point[]; color: string; width: number };
const palettes = ["#252c3b", "#ef7863", "#6c86de", "#48a58b", "#d9a64e", "#a878c9"];

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  if (!shape.points.length) return;
  ctx.strokeStyle = shape.color; ctx.lineWidth = shape.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const [start, end = start] = [shape.points[0], shape.points[shape.points.length - 1]];
  ctx.beginPath();
  if (shape.type === "pen") {
    ctx.moveTo(start.x, start.y);
    shape.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  } else if (shape.type === "line") {
    ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
  } else if (shape.type === "rectangle") {
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else {
    const rx = (end.x - start.x) / 2, ry = (end.y - start.y) / 2;
    ctx.ellipse(start.x + rx, start.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

function isNearShape(shape: Shape, point: Point) {
  const xs = shape.points.map((p) => p.x), ys = shape.points.map((p) => p.y);
  return point.x >= Math.min(...xs) - 12 && point.x <= Math.max(...xs) + 12 &&
    point.y >= Math.min(...ys) - 12 && point.y <= Math.max(...ys) + 12;
}

export default function Whiteboard({ provider, cursors }: { provider: RoomProvider; cursors: Cursor[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const invalidateRef = useRef<() => void>(() => {});
  const drawingRef = useRef<Shape | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(palettes[1]);
  const [width, setWidth] = useState(3);
  const [drawing, setDrawing] = useState<Shape | null>(null);
  const shapes = provider.doc.getMap<Shape>("shapes");
  const order = provider.doc.getArray<string>("shapeOrder");

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;
    let disposed = false;
    const render = () => {
      if (disposed || frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const bounds = container.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(bounds.width * ratio));
        const pixelHeight = Math.max(1, Math.round(bounds.height * ratio));
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth; canvas.height = pixelHeight;
          canvas.style.width = `${bounds.width}px`; canvas.style.height = `${bounds.height}px`;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, bounds.width, bounds.height);
        order.toArray().forEach((id) => { const shape = shapes.get(id); if (shape) drawShape(ctx, shape); });
        const current = drawingRef.current;
        if (current) drawShape(ctx, current);
      });
    };
    invalidateRef.current = render;
    const observer = new ResizeObserver(render);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      render();
    };
    observer.observe(container);
    shapes.observe(render); order.observe(render);
    window.addEventListener("resize", render);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    render();
    return () => {
      disposed = true; observer.disconnect(); shapes.unobserve(render); order.unobserve(render);
      window.removeEventListener("resize", render);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      invalidateRef.current = () => {};
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [order, shapes]);

  const pointFromEvent = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (tool === "eraser") {
      const point = pointFromEvent(event);
      const toRemove = order.toArray().filter((id) => { const shape = shapes.get(id); return shape && isNearShape(shape, point); });
      if (toRemove.length) {
        const remaining = order.toArray().filter((id) => !toRemove.includes(id));
        provider.doc.transact(() => {
          toRemove.forEach((id) => shapes.delete(id));
          order.delete(0, order.length);
          order.insert(0, remaining);
        });
      }
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointFromEvent(event);
    const next: Shape = { id: crypto.randomUUID(), type: tool, points: [start], color, width };
    drawingRef.current = next; setDrawing(next); invalidateRef.current();
  };
  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const point = pointFromEvent(event);
    const rect = event.currentTarget.getBoundingClientRect();
    provider.sendCursor(point.x / rect.width, point.y / rect.height);
    const current = drawingRef.current;
    if (!current) return;
    const next = { ...current, points: current.type === "pen" ? [...current.points, point] : [current.points[0], point] };
    drawingRef.current = next; setDrawing(next);
    invalidateRef.current();
  };
  const onPointerUp = () => {
    const shape = drawingRef.current;
    if (!shape) return;
    drawingRef.current = null; setDrawing(null);
    invalidateRef.current();
    provider.doc.transact(() => { shapes.set(shape.id, shape); order.push([shape.id]); });
  };
  const clearBoard = () => {
    if (!order.length) return;
    provider.doc.transact(() => { order.toArray().forEach((id) => shapes.delete(id)); order.delete(0, order.length); });
  };

  return <div className="board-content">
    <div className="board-toolbar">
      <div className="tool-group">
        {([["pen", "✎", "Pen"], ["line", "／", "Line"], ["rectangle", "▱", "Rectangle"], ["ellipse", "◯", "Ellipse"], ["eraser", "⌫", "Eraser"]] as const).map(([id, icon, label]) =>
          <button key={id} className={`tool ${tool === id ? "active" : ""}`} title={label} aria-label={label} onClick={() => setTool(id)}>{icon}</button>)}
      </div>
      <span className="toolbar-separator" />
      <div className="color-group">{palettes.map((swatch) => <button key={swatch} aria-label={`Color ${swatch}`} title={`Color ${swatch}`} className={`color-swatch ${color === swatch ? "selected" : ""}`} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} />)}</div>
      <span className="toolbar-separator" />
      <label className="stroke-control" title="Stroke width"><span className="stroke-preview" style={{ height: Math.max(2, width) }} /><input aria-label="Stroke width" type="range" min="1" max="10" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
      <button className="clear-button" onClick={clearBoard} title="Clear whiteboard">Clear</button>
    </div>
    <div className="canvas-area">
      <canvas ref={canvasRef} className="whiteboard-canvas" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
      {cursors.map((cursor) => <div key={cursor.socketId} className="remote-cursor" style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, color: cursor.color }}><span>↖</span><b style={{ backgroundColor: cursor.color }}>{cursor.name}</b></div>)}
      {!order.length && !drawing && <div className="canvas-empty"><span>✳</span><p>Start with a line, a shape,<br />or whatever comes to mind.</p></div>}
    </div>
    <div className="board-bottom"><span><i /> Changes sync as you draw</span><span>DRAG TO SKETCH</span></div>
  </div>;
}
