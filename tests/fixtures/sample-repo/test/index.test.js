import assert from "node:assert/strict";
import test from "node:test";

import { greeting } from "../src/index.js";

test("greeting includes the supplied name", () => {
  assert.equal(greeting("pilot"), "Hello, pilot.");
});
