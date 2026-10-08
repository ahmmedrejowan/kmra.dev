import type { APIRoute } from "astro";
import { og, ogPaths, type OgPage } from "@kmra/ui/lib/routes";

export const getStaticPaths = () => ogPaths("devtool");
export const GET: APIRoute = ({ props }) =>
  og("devtool", (props as { page: OgPage }).page);
