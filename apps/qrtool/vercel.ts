import { appConfig } from "@kmra/config/vercel";

// The scanner reads QR codes with the camera, so this app may ask for it.
export default appConfig({ camera: true });
