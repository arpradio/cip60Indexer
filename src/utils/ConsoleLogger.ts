import chalk from 'chalk';

export class ConsoleLogger {
    private static lastLine = '';

    static updateProgress(currentSlot: number, tipSlot: number, blockHeight: number): void {
        const progress = (currentSlot / tipSlot);
        const percentage = (progress * 100).toFixed(2);
        
        const barWidth = 30;
        const filled = Math.round(progress * barWidth);
        const empty = barWidth - filled;
        const progressBar = chalk.blue('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

        const statusLine = 
            `\r${chalk.blue('⚡')} Syncing: [${progressBar}] ${chalk.cyan(percentage)}% | ` +
            `${chalk.yellow('⛓⛓')} Resume Block: ${chalk.white(blockHeight)} | ` +
            `${chalk.magenta('◇')} Slot: ${chalk.white(currentSlot)}/${chalk.gray(tipSlot)}`;

        if (this.lastLine) {
            process.stdout.write('\r' + ' '.repeat(this.lastLine.length));
        }
        process.stdout.write('\r' + statusLine);
        this.lastLine = statusLine;
    }

    static logError(message: string, error?: unknown): void {
        this.clearProgress();
        console.error(chalk.red('✖'), message);
        if (error) {
            if (error instanceof Error) {
                console.error(chalk.gray(error.message));
            } else {
                console.error(chalk.gray(String(error)));
            }
        }
        console.log();
    }

    static logInfo(message: string): void {
        this.clearProgress();
        console.log(chalk.blue('ℹ'), message);
        console.log();
    }

    static logSuccess(message: string): void {
        this.clearProgress();
        console.log(chalk.green('✓'), message);
        console.log();
    }

    static logWarning(message: string): void {
        this.clearProgress();
        console.log(chalk.yellow('⚠'), message);
        console.log();
    }

    static logMetadataFound(policyId: string, assetName: string, version: string): void {
        this.clearProgress();
        const truncatedPolicyId = `${policyId.slice(0, 8)}...${policyId.slice(-8)}`;
        console.log(
            chalk.green('♪'),
            chalk.blue('Found CIP-60 Music Token:'),
            chalk.gray(`[v${version}]`),
            chalk.yellow(truncatedPolicyId),
            chalk.cyan(assetName)
        );
    }

    private static clearProgress(): void {
        if (this.lastLine) {
            process.stdout.write('\r' + ' '.repeat(this.lastLine.length) + '\r');
            this.lastLine = '';
        }
    }
}