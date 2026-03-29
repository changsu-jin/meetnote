/**
 * Centralized sherpa-onnx loader.
 *
 * Loads the native addon from the plugin's node_modules directory,
 * bypassing Electron's ASAR packaging.
 */

import * as path from "path";

let _sherpa: any = null;
let _pluginDir: string = "";

/**
 * Get the sherpa-onnx module, loading it from the plugin's node_modules.
 * Must call initSherpa() first.
 */
export function getSherpa(pluginDir?: string): any {
	if (_sherpa) return _sherpa;

	const dir = pluginDir || _pluginDir;
	if (!dir) throw new Error("sherpa-onnx not initialized. Call initSherpa() first.");

	const sherpaPath = path.join(dir, "node_modules", "sherpa-onnx-node");

	try {
		// Use createRequire to load from plugin directory, not from ASAR
		const { createRequire } = require("module");
		const pluginRequire = createRequire(path.join(dir, "package.json"));
		_sherpa = pluginRequire("sherpa-onnx-node");
	} catch (e1) {
		try {
			// Fallback: direct path require
			_sherpa = require(sherpaPath);
		} catch (e2) {
			throw new Error(
				`sherpa-onnx-node를 로드할 수 없습니다.\n` +
				`플러그인 디렉토리에 node_modules/sherpa-onnx-node가 있는지 확인하세요.\n` +
				`경로: ${sherpaPath}\n` +
				`에러1: ${e1}\n에러2: ${e2}`
			);
		}
	}

	_pluginDir = dir;
	return _sherpa;
}

/**
 * Initialize sherpa-onnx with the plugin directory path.
 * Call this once during plugin startup.
 */
export function initSherpa(pluginDir: string): void {
	_pluginDir = pluginDir;
	// Don't load yet — lazy load on first use
}
