import type { ToolProps } from ".";
import { CodeFormatter } from "../lib/codefmt";

export default function JsFormatter({ preset }: ToolProps) {
  return <CodeFormatter kind="js" preset={preset} />;
}
