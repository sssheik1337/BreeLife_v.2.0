import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = path.resolve(process.cwd(), 'src');
const TARGET_EXTENSIONS = new Set(['.vue', '.ts', '.js', '.css', '.html', '.md']);
const SUSPICIOUS_PAIR_REGEX = /[\u0420\u0421][\u00A0-\u00BF\u0400-\u040F\u0450-\u045F\u0490-\u049F\u2010-\u2030\u20A0-\u20CF]/g;

const cp1251Decoder = new TextDecoder('windows-1251');
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const cp1251CharToByte = new Map();

for (let byte = 0; byte <= 255; byte += 1) {
    const char = cp1251Decoder.decode(Uint8Array.of(byte));
    if (!cp1251CharToByte.has(char)) {
        cp1251CharToByte.set(char, byte);
    }
}

const countSuspiciousPairs = (value) => {
    const matches = value.match(SUSPICIOUS_PAIR_REGEX);
    return matches ? matches.length : 0;
};

const decodeMojibakeLine = (line) => {
    const bytes = [];
    for (const char of line) {
        const codePoint = char.codePointAt(0);
        if (codePoint <= 0x7f) {
            bytes.push(codePoint);
            continue;
        }
        const mappedByte = cp1251CharToByte.get(char);
        if (mappedByte === undefined) {
            return null;
        }
        bytes.push(mappedByte);
    }

    try {
        return utf8Decoder.decode(Uint8Array.from(bytes));
    } catch {
        return null;
    }
};

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

const shouldFixLine = (line) => countSuspiciousPairs(line) >= 2;

const fixFile = (filePath, writeChanges) => {
    const source = fs.readFileSync(filePath, 'utf8');
    const newLine = source.includes('\r\n') ? '\r\n' : '\n';
    const lines = source.split(/\r?\n/);

    let changed = false;
    const fixedLines = lines.map((line) => {
        if (!shouldFixLine(line)) {
            return line;
        }

        const decoded = decodeMojibakeLine(line);
        if (!decoded) {
            return line;
        }

        const originalScore = countSuspiciousPairs(line);
        const decodedScore = countSuspiciousPairs(decoded);
        if (decodedScore >= originalScore) {
            return line;
        }

        changed = true;
        return decoded;
    });

    if (changed && writeChanges) {
        fs.writeFileSync(filePath, fixedLines.join(newLine), 'utf8');
    }

    return changed;
};

const main = () => {
    const writeChanges = process.argv.includes('--write');
    const files = collectFiles(ROOT_DIR);
    const changedFiles = [];

    for (const filePath of files) {
        if (fixFile(filePath, writeChanges)) {
            changedFiles.push(filePath);
        }
    }

    if (changedFiles.length === 0) {
        console.log('No mojibake fixes needed.');
        return;
    }

    const mode = writeChanges ? 'Updated' : 'Would update';
    console.log(`${mode} ${changedFiles.length} file(s):`);
    changedFiles.forEach((filePath) => console.log(`- ${path.relative(process.cwd(), filePath)}`));
};

main();
