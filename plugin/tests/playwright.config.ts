import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 60000,
	expect: {
		timeout: 10000,
	},
	use: {
		trace: "on-first-retry",
	},
	retries: 0,
	workers: 1, // Obsidian can only run one instance
});
