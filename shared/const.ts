export const COOKIE_NAME = "app_session_id";

export const DEVICE_TYPES = [
  "Smartphone",
  "Notebook",
  "Tablet",
  "Smartwatch",
  "Impressora",
  "Console / Videogame",
  "Câmera / Filmadora",
  "Fone de ouvido / Headset",
  "Caixa de som",
  "Roteador / Modem",
  "Smart TV",
  "Desktop / PC",
  "Monitor",
  "Teclado / Mouse",
  "Drone",
  "Outro",
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number];
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
