import type { ToolProps } from ".";
import { CodeFormatter } from "../lib/codefmt";

export default function HtmlFormatter({ preset }: ToolProps) {
  return <CodeFormatter kind="html" preset={preset} />;
}
