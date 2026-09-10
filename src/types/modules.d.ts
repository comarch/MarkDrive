declare module "markdown-it-task-lists" {
  import MarkdownIt from "markdown-it";
  const taskLists: MarkdownIt.PluginSimple;
  export default taskLists;
}

declare module "markdown-it-emoji" {
  import MarkdownIt from "markdown-it";
  export const full: MarkdownIt.PluginSimple;
  export const light: MarkdownIt.PluginSimple;
  export const bare: MarkdownIt.PluginSimple;
}
