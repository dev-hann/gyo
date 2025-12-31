"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.validateConfig = validateConfig;
const path = __importStar(require("path"));
const fs_1 = require("./fs");
const logger_1 = require("./logger");
exports.DEFAULT_CONFIG = {
    name: 'gyo-app',
    version: '1.0.0',
    serverUrl: 'http://localhost:3000',
    platforms: {
        android: {
            enabled: true,
            packageName: 'com.example.gyoapp'
        },
        ios: {
            enabled: true,
            bundleId: 'com.example.gyoapp'
        },
        desktop: {
            enabled: false
        }
    },
    webview: {
        allowFileAccess: false,
        allowUniversalAccessFromFileURLs: false
    },
    devServer: {
        port: 3000,
        host: 'localhost'
    }
};
async function loadConfig(projectPath = process.cwd()) {
    const configPath = path.join(projectPath, 'gyo.config.json');
    if (!(await (0, fs_1.pathExists)(configPath))) {
        logger_1.logger.error('gyo.config.json not found in the current directory');
        return null;
    }
    try {
        const config = await (0, fs_1.readJson)(configPath);
        return config;
    }
    catch (error) {
        logger_1.logger.error(`Failed to load config: ${error}`);
        return null;
    }
}
async function saveConfig(config, projectPath = process.cwd()) {
    const configPath = path.join(projectPath, 'gyo.config.json');
    await (0, fs_1.writeJson)(configPath, config);
}
function validateConfig(config) {
    if (!config.name || !config.version || !config.serverUrl) {
        logger_1.logger.error('Config must have name, version, and serverUrl');
        return false;
    }
    if (!config.platforms || Object.keys(config.platforms).length === 0) {
        logger_1.logger.error('Config must have at least one platform enabled');
        return false;
    }
    return true;
}
//# sourceMappingURL=config.js.map