export { default } from "./guest-flow.js";
import { SMOKE_THRESHOLDS } from "./config.js";

export const options = {
  scenarios: {
    guest_flow_smoke: {
      executor: "constant-vus",
      vus: 5,
      duration: "30s",
    },
  },
  thresholds: {
    ...SMOKE_THRESHOLDS,
    "http_req_failed{name:order_stream}": ["rate<0.15"],
  },
};
