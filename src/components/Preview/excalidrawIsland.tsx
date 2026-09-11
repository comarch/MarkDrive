// Lazy island bundle for Excalidraw embeds. The editor and preview
// never import this module directly, so the scene renderer stays out
// of the main bundle until a document actually embeds a scene.
import * as React from "react";

export { Excalidraw } from "@excalidraw/excalidraw";
export { React };
