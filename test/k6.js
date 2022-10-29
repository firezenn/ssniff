import http from "k6/http";
import { Counter } from "k6/metrics";
export const requests = new Counter("http_reqs");

export const options = {
  scenarios: {
    closed_model: {
      executor: "constant-arrival-rate",
      rate: __ENV.RATE,
      timeUnit: "1s",
      duration: __ENV.DURATION,
      preAllocatedVUs: __ENV.PRE_ALLOC,
    },
  },
};

const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function randomString(length) {
  let result = "";
  for (let i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export default function () {
  const payload = [];
  for (let i = 0; i < 9; i++) {
    payload.push({
      [`${randomString(10)}`]: randomString(250),
    });
  }

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: randomString(150),
    },
  };

  http.post(__ENV.TARGET, JSON.stringify(payload), params);
}
