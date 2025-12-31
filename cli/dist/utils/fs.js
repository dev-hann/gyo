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
exports.ensureDir = ensureDir;
exports.copyDir = copyDir;
exports.pathExists = pathExists;
exports.readJson = readJson;
exports.writeJson = writeJson;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.removeDir = removeDir;
exports.getTemplatesPath = getTemplatesPath;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
async function ensureDir(dirPath) {
    await fs.ensureDir(dirPath);
}
async function copyDir(src, dest) {
    await fs.copy(src, dest);
}
async function pathExists(filePath) {
    return await fs.pathExists(filePath);
}
async function readJson(filePath) {
    return await fs.readJson(filePath);
}
async function writeJson(filePath, data) {
    await fs.writeJson(filePath, data, { spaces: 2 });
}
async function readFile(filePath) {
    return await fs.readFile(filePath, 'utf-8');
}
async function writeFile(filePath, content) {
    await fs.writeFile(filePath, content, 'utf-8');
}
async function removeDir(dirPath) {
    await fs.remove(dirPath);
}
function getTemplatesPath() {
    // In development, templates are in the project root
    // In production, they should be bundled with the CLI
    const devPath = path.join(__dirname, '../../../templates');
    const prodPath = path.join(__dirname, '../../templates');
    if (fs.existsSync(devPath)) {
        return devPath;
    }
    return prodPath;
}
//# sourceMappingURL=fs.js.map