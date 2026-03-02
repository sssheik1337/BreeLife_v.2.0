import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const spaRoot = path.resolve(scriptDir, '..');
const pagesDir = path.join(spaRoot, 'src', 'pages');

const rules = [
    { name: '/static/js/', regex: /\/static\/js\// },
    { name: "createElement('script')", regex: /createElement\((['"])script\1\)/ },
    { name: 'appendChild(script)', regex: /appendChild\(\s*script\s*\)/ },
    { name: 'initUiShell', regex: /\binitUiShell\b/ },
    { name: 'initQuestionnaire', regex: /\binitQuestionnaire\b/ },
    { name: 'initDiary', regex: /\binitDiary\b/ },
    { name: 'window.location.replace', regex: /window\.location\.replace\b/ },
    { name: 'window.location.href', regex: /window\.location\.href\b/ }
];

const collectVueFiles = (dirPath) => {
    const files = [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectVueFiles(fullPath));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.vue')) {
            files.push(fullPath);
        }
    }
    return files;
};

if (!fs.existsSync(pagesDir)) {
    console.error(`Missing pages directory: ${pagesDir}`);
    process.exit(1);
}

const vueFiles = collectVueFiles(pagesDir);
const violations = [];

for (const filePath of vueFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
        for (const rule of rules) {
            if (rule.regex.test(line)) {
                violations.push({
                    rule: rule.name,
                    file: path.relative(spaRoot, filePath).split(path.sep).join('/'),
                    line: index + 1,
                    text: line.trim()
                });
            }
        }
    });
}

if (violations.length > 0) {
    console.error(`Found ${violations.length} migration gate violation(s):`);
    for (const item of violations) {
        console.error(`${item.file}:${item.line}: ${item.text} [${item.rule}]`);
    }
    process.exit(1);
}

console.log(`Migration gate passed. Checked ${vueFiles.length} Vue page(s).`);
