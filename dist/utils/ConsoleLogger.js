"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ConsoleLogger {
    static updateProgress(currentSlot, tipSlot, blockHeight) {
        const progress = (currentSlot / tipSlot);
        const percentage = (progress * 100).toFixed(2);
        const barWidth = 30;
        const filled = Math.round(progress * barWidth);
        const empty = barWidth - filled;
        const progressBar = chalk_1.default.blue('█'.repeat(filled)) + chalk_1.default.gray('░'.repeat(empty));
        const statusLine = `\r${chalk_1.default.blue('⚡')} Syncing: [${progressBar}] ${chalk_1.default.cyan(percentage)}% | ` +
            `${chalk_1.default.yellow('⛓⛓')} Resume Block: ${chalk_1.default.white(blockHeight)} | ` +
            `${chalk_1.default.magenta('◇')} Slot: ${chalk_1.default.white(currentSlot)}/${chalk_1.default.gray(tipSlot)}`;
        if (this.lastLine) {
            process.stdout.write('\r' + ' '.repeat(this.lastLine.length));
        }
        process.stdout.write('\r' + statusLine);
        this.lastLine = statusLine;
    }
    static logError(message, error) {
        this.clearProgress();
        console.error(chalk_1.default.red('✖'), message);
        if (error) {
            if (error instanceof Error) {
                console.error(chalk_1.default.gray(error.message));
            }
            else {
                console.error(chalk_1.default.gray(String(error)));
            }
        }
        console.log();
    }
    static logInfo(message) {
        this.clearProgress();
        console.log(chalk_1.default.blue('ℹ'), message);
        console.log();
    }
    static logSuccess(message) {
        this.clearProgress();
        console.log(chalk_1.default.green('✓'), message);
        console.log();
    }
    static logWarning(message) {
        this.clearProgress();
        console.log(chalk_1.default.yellow('⚠'), message);
        console.log();
    }
    static logMetadataFound(policyId, assetName, version) {
        this.clearProgress();
        const truncatedPolicyId = `${policyId.slice(0, 8)}...${policyId.slice(-8)}`;
        console.log(chalk_1.default.green('♪'), chalk_1.default.blue('Found CIP-60 Music Token:'), chalk_1.default.gray(`[v${version}]`), chalk_1.default.yellow(truncatedPolicyId), chalk_1.default.cyan(assetName));
    }
    static clearProgress() {
        if (this.lastLine) {
            process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
            this.lastLine = '';
        }
    }
}
exports.ConsoleLogger = ConsoleLogger;
ConsoleLogger.lastLine = '';
