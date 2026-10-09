import { appConfig } from "@kmra/config/vercel";

// The hub frames each app's /handoff page to pass a dropped file over
export default appConfig({ hub: true });
