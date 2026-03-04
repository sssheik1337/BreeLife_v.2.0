import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = path.resolve(process.cwd(), 'src');
const TARGET_EXTENSIONS = new Set(['.vue', '.ts', '.js', '.css', '.html', '.md']);
const SUSPICIOUS_PAIR_REGEX = /[\u0420\u0421][\u00A0-\u00BF\u0400-\u040F\u0450-\u045F\u0490-\u049F\u2010-\u2030\u20A0-\u20CF]/g;

const isTargetFile = (filePath) => TARGET_EXTENSIONS.has(path.extname(filePath).toLowerCase());

const collectFiles = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            result.push(...collectFiles(fullPath));
            continue;
        }
        if (entry.isFile() && isTargetFile(fullPath)) {
            result.push(fullPath);
        }
    }

    return result;
};

const countSuspiciousPairs = (value) => {
    const matches = value.match(SUSPICIOUS_PAIR_REGEX);
    return matches ? matches.length : 0;
};

const truncateLine = (line, maxLength = 220) => {
    if (line.length <= maxLength) {
        return line;
    }
    return `${line.slice(0, maxLength)}...`;
};

const main = () => {
    const files = collectFiles(ROOT_DIR);
    const issues = [];

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            if (line.includes('\uFFFD')) {
                issues.push({
                    filePath,
                    lineNumber,
                    reason: 'contains replacement char U+FFFD',
                    line
                });
                return;
            }

            if (countSuspiciousPairs(line) >= 2) {
                issues.push({
                    filePath,
                    lineNumber,
                    reason: 'looks like mojibake',
                    line
                });
            }
        });
    }

    if (issues.length === 0) {
        console.log(`Encoding check passed. Checked ${files.length} file(s).`);
        return;
    }

    console.error(`Encoding check failed: found ${issues.length} issue(s).`);
    for (const issue of issues) {
        console.error(`${path.relative(process.cwd(), issue.filePath)}:${issue.lineNumber}: ${issue.reason}`);
        console.error(`  ${truncateLine(issue.line)}`);
    }
    process.exitCode = 1;
};

main();
