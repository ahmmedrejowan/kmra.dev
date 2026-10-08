import type { ToolProps } from ".";
import { CodeFormatter } from "../lib/codefmt";

export default function CssFormatter({ preset }: ToolProps) {
  return <CodeFormatter kind="css" preset={preset} />;
}
