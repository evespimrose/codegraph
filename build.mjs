import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bundleRoot = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_DIGEST_CONTRACT = 'sha256 of UTF-8 JSONL [relativePosixPath,sha256,size] records sorted by path; exact file bytes; excludes node_modules,.git,.cache,.codegraph,.serena directories';
const excludedSourceDirectories = new Set(['node_modules', '.git', '.cache', '.codegraph', '.serena']);

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function listFiles(root, excluded = new Set()) {
  const files = [];
  function visit(directory, prefix) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Source and release snapshots cannot contain symbolic links: ${relative}`);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported snapshot entry: ${relative}`);
    }
  }
  visit(root, '');
  return files.sort();
}

export function describeFiles(root, excluded = new Set()) {
  return listFiles(root, excluded).map(relative => {
    const bytes = fs.readFileSync(path.join(root, relative));
    return { path: relative, sha256: sha256(bytes), size: bytes.length };
  });
}

export function describeSource(sourceRoot) {
  const files = describeFiles(sourceRoot, excludedSourceDirectories);
  const records = files.map(file => JSON.stringify([file.path, file.sha256, file.size]) + '\n').join('');
  return { version: 1, contract: SOURCE_DIGEST_CONTRACT, sourceTreeSha256: sha256(records), files };
}

export function describeGrammarSources(grammarRoot, sourceRoot) {
  const snapshot = describeSource(grammarRoot);
  for (const file of snapshot.files.filter(file => file.path.endsWith('/artifact.json'))) {
    const metadata = JSON.parse(fs.readFileSync(path.join(grammarRoot, file.path), 'utf8'));
    if (typeof metadata.runtimePath !== 'string' || !metadata.runtimePath.startsWith('source/') || !/^[a-f0-9]{64}$/.test(metadata.sha256)) {
      throw new Error(`Grammar artifact metadata is invalid: ${file.path}`);
    }
    const runtimeFile = path.resolve(sourceRoot, metadata.runtimePath.slice('source/'.length));
    requireInside(sourceRoot, runtimeFile);
    if (sha256(fs.readFileSync(runtimeFile)) !== metadata.sha256) throw new Error(`Grammar artifact checksum mismatch: ${metadata.runtimePath}`);
  }
  return { version: snapshot.version, contract: snapshot.contract, grammarTreeSha256: snapshot.sourceTreeSha256, files: snapshot.files };
}

function writeJson(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(value, null, 2) + '\n');
}

function requireInside(root, destination) {
  const relative = path.relative(path.resolve(root), path.resolve(destination));
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error(`Path must be a child of ${root}: ${destination}`);
  }
}

function removeStaged(root, destination) {
  requireInside(root, destination);
  if (fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.error || result.status !== 0) throw new Error(`${command} failed: ${result.error?.message || result.stderr || result.stdout || result.status}`);
  return result.stdout.trim();
}

export function verifyRuntimeInput(inputRoot, platform) {
  const manifest = JSON.parse(fs.readFileSync(path.join(inputRoot, 'manifest.json'), 'utf8'));
  const artifact = manifest.artifacts?.[platform];
  if (!artifact || !/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error(`Verified runtime artifact missing for ${platform}`);
  const archive = path.resolve(inputRoot, artifact.archive);
  requireInside(inputRoot, archive);
  const bytes = fs.readFileSync(archive);
  if (bytes.length !== artifact.size || sha256(bytes) !== artifact.sha256) throw new Error(`Runtime archive checksum or size mismatch: ${archive}`);
  return { manifest, artifact, archive };
}

function copySnapshot(sourceRoot, targetRoot, files) {
  for (const file of files) {
    const destination = path.join(targetRoot, file.path);
    requireInside(targetRoot, destination);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, file.path), destination);
  }
}

function verifyModelFiles(modelsRoot, modelManifest) {
  const modelDirectory = path.resolve(modelsRoot, ...modelManifest.modelId.split('/'));
  requireInside(modelsRoot, modelDirectory);
  const entries = [...modelManifest.files, modelManifest.licenseFile];
  for (const entry of entries) {
    const file = path.resolve(modelDirectory, entry.path);
    requireInside(modelDirectory, file);
    const bytes = fs.readFileSync(file);
    if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error(`Embedding model asset checksum or size mismatch: ${entry.path}`);
  }
  return { modelDirectory, entries };
}

function stageEmbeddingModel(modelsRoot, spec, modelRoot) {
  const stagedManifestPath = path.join(modelsRoot, 'model-manifest.json');
  const stagedBytes = fs.existsSync(stagedManifestPath) ? fs.readFileSync(stagedManifestPath) : null;
  const staged = stagedBytes ? JSON.parse(stagedBytes) : null;
  if (staged?.modelId === spec.id && staged?.revision === spec.revision
    && (!spec.manifestSha256 || sha256(stagedBytes) === spec.manifestSha256)) return;
  if (!modelRoot) throw new Error(`Embedding model ${spec.id}@${spec.revision} is not in the base runtime. Pass --model-root with its pinned model-manifest.json and assets.`);
  const sourceManifestPath = path.join(modelRoot, 'model-manifest.json');
  const manifestBytes = fs.readFileSync(sourceManifestPath);
  if (sha256(manifestBytes) !== spec.manifestSha256) throw new Error('Embedding model manifest does not match manifest.json embeddingModel.manifestSha256.');
  const modelManifest = JSON.parse(manifestBytes);
  if (modelManifest.modelId !== spec.id || modelManifest.revision !== spec.revision
    || modelManifest.license !== spec.license || modelManifest.dimension !== spec.dimension) {
    throw new Error('Embedding model manifest identity differs from manifest.json embeddingModel.');
  }
  const { modelDirectory, entries } = verifyModelFiles(path.resolve(modelRoot), modelManifest);
  fs.rmSync(modelsRoot, { recursive: true, force: true });
  copySnapshot(modelDirectory, path.resolve(modelsRoot, ...modelManifest.modelId.split('/')), entries);
  fs.copyFileSync(sourceManifestPath, stagedManifestPath);
  verifyModelFiles(modelsRoot, modelManifest);
}

export function buildBundle({ inputRoot = bundleRoot, outputRoot = bundleRoot, sourceRoot = path.join(bundleRoot, 'source'), grammarRoot = path.join(bundleRoot, 'grammars'), modelRoot, platform = 'win32-x64' } = {}) {
  inputRoot = path.resolve(inputRoot);
  outputRoot = path.resolve(outputRoot);
  sourceRoot = path.resolve(sourceRoot);
  grammarRoot = path.resolve(grammarRoot);
  const { manifest: inputManifest, artifact: inputArtifact, archive: inputArchive } = verifyRuntimeInput(inputRoot, platform);
  const source = describeSource(sourceRoot);
  const grammarSources = describeGrammarSources(grammarRoot, sourceRoot);
  const sourcePackage = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(sourcePackage.version)) throw new Error('Source package version must be a semantic version.');
  if (sourcePackage.name !== 'team-codegraph' || sourcePackage.private !== true) throw new Error('Expected the private team-codegraph source package.');
  const sourceEntry = path.join(sourceRoot, 'lib', 'bin', 'codegraph.js');
  if (!fs.statSync(sourceEntry).isFile()) throw new Error('Maintained CommonJS CLI entry is missing.');
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'team-codegraph-build-'));
  const releaseName = `codegraph-${platform}`;
  const releaseRoot = path.join(stage, releaseName);
  try {
    run('tar', ['-xf', inputArchive, '-C', stage]);
    if (!fs.statSync(releaseRoot).isDirectory()) throw new Error('Runtime archive has an unexpected root directory.');
    const packagedLib = path.join(releaseRoot, 'lib');
    removeStaged(stage, path.join(releaseRoot, 'source'));
    removeStaged(stage, path.join(releaseRoot, 'SOURCE-MANIFEST.json'));
    removeStaged(stage, path.join(releaseRoot, 'grammar-sources'));
    removeStaged(stage, path.join(releaseRoot, 'GRAMMAR-MANIFEST.json'));
    removeStaged(stage, path.join(releaseRoot, 'release-integrity.json'));
    copySnapshot(sourceRoot, path.join(releaseRoot, 'source'), source.files);
    if (describeSource(path.join(releaseRoot, 'source')).sourceTreeSha256 !== source.sourceTreeSha256) throw new Error('Source snapshot changed while being copied.');
    copySnapshot(grammarRoot, path.join(releaseRoot, 'grammar-sources'), grammarSources.files);
    if (describeGrammarSources(path.join(releaseRoot, 'grammar-sources'), path.join(releaseRoot, 'source')).grammarTreeSha256 !== grammarSources.grammarTreeSha256) throw new Error('Grammar source snapshot changed while being copied.');
    removeStaged(stage, path.join(packagedLib, 'dist'));
    fs.cpSync(path.join(releaseRoot, 'source', 'lib'), path.join(packagedLib, 'dist'), { recursive: true, dereference: false });
    const modelsRoot = path.join(packagedLib, 'models');
    requireInside(stage, modelsRoot);
    stageEmbeddingModel(modelsRoot, inputManifest.embeddingModel, modelRoot && path.resolve(modelRoot));
    const packagedPackage = {
      ...sourcePackage,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      bin: { codegraph: './dist/bin/codegraph.js' },
      files: ['dist', 'README.md', 'LICENSE', 'NOTICE'],
      scripts: { cli: 'node dist/bin/codegraph.js' },
    };
    writeJson(path.join(packagedLib, 'package.json'), packagedPackage);
    for (const name of ['LICENSE', 'NOTICE', 'README.md']) {
      const from = path.join(releaseRoot, 'source', name);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(packagedLib, name));
    }
    fs.copyFileSync(path.join(releaseRoot, 'source', 'LICENSE'), path.join(releaseRoot, 'CODEGRAPH-LICENSE.txt'));
    fs.copyFileSync(path.join(releaseRoot, 'source', 'NOTICE'), path.join(releaseRoot, 'TEAM-CODEGRAPH-NOTICE.txt'));
    writeJson(path.join(releaseRoot, 'SOURCE-MANIFEST.json'), source);
    writeJson(path.join(releaseRoot, 'GRAMMAR-MANIFEST.json'), grammarSources);
    const finalSource = describeSource(sourceRoot);
    if (finalSource.sourceTreeSha256 !== source.sourceTreeSha256) throw new Error('Maintained source changed during the build; retry after source edits finish.');
    if (describeGrammarSources(grammarRoot, sourceRoot).grammarTreeSha256 !== grammarSources.grammarTreeSha256) throw new Error('Grammar source changed during the build; retry after source edits finish.');
    const nodePath = path.join(releaseRoot, platform.startsWith('win32') ? 'node.exe' : 'node');
    const actualVersion = run(nodePath, [path.join(packagedLib, 'dist', 'bin', 'codegraph.js'), '--version'], { env: { ...process.env, CODEGRAPH_NO_WATCH: '1' } });
    if (actualVersion !== sourcePackage.version) throw new Error(`Staged CLI version mismatch: ${actualVersion}`);
    // 소스 상수와 번들 모델이 어긋나면 런타임은 임베딩을 조용히 끄고 어휘 검색만 남김. 빌드에서 막아야 함
    const assetCheck = `const s = require(${JSON.stringify(path.join(packagedLib, 'dist', 'docs', 'model-assets.js'))}).inspectModelAssets(${JSON.stringify(modelsRoot)}); if (!s.valid) { console.error(s.issues.join('; ')); process.exit(1); }`;
    run(nodePath, ['-e', assetCheck], { env: { ...process.env, CODEGRAPH_NO_WATCH: '1' } });
    const integrity = { version: 1, codegraphVersion: sourcePackage.version, sourceTreeSha256: source.sourceTreeSha256, grammarTreeSha256: grammarSources.grammarTreeSha256, files: describeFiles(releaseRoot) };
    writeJson(path.join(releaseRoot, 'release-integrity.json'), integrity);
    const integritySha256 = sha256(fs.readFileSync(path.join(releaseRoot, 'release-integrity.json')));
    const artifactRelative = platform.startsWith('win32') ? `artifacts/codegraph-${platform}.zip` : `artifacts/codegraph-${platform}.tar.gz`;
    fs.mkdirSync(path.join(outputRoot, 'artifacts'), { recursive: true });
    const temporaryArchive = path.join(stage, path.basename(artifactRelative));
    run('tar', ['-a', '-cf', temporaryArchive, '-C', stage, releaseName]);
    const archiveBytes = fs.readFileSync(temporaryArchive);
    const artifact = { archive: artifactRelative, size: archiveBytes.length, sha256: sha256(archiveBytes), integrityManifest: 'release-integrity.json', integritySha256 };
    const { sourceCommit, sourceState, artifacts, ...retainedManifest } = inputManifest;
    const manifest = {
      ...retainedManifest,
      version: 2,
      codegraphVersion: sourcePackage.version,
      sourceTreeSha256: source.sourceTreeSha256,
      sourceDigestContract: SOURCE_DIGEST_CONTRACT,
      sourceSnapshot: 'source',
      sourceManifest: 'SOURCE-MANIFEST.json',
      grammarSources: { snapshot: 'grammar-sources', manifest: 'GRAMMAR-MANIFEST.json', treeSha256: grammarSources.grammarTreeSha256, digestContract: SOURCE_DIGEST_CONTRACT },
      runtimeAssets: { baseArtifactSha256: inputArtifact.sha256, baseCodegraphVersion: inputManifest.codegraphVersion },
      artifacts: { [platform]: artifact },
    };
    const outputArchive = path.join(outputRoot, artifactRelative);
    fs.copyFileSync(temporaryArchive, `${outputArchive}.stage`);
    fs.renameSync(`${outputArchive}.stage`, outputArchive);
    writeJson(path.join(outputRoot, 'manifest.json'), manifest);
    if (outputRoot !== bundleRoot) {
      for (const name of ['install.ps1', 'install.sh', 'LICENSE']) fs.copyFileSync(path.join(bundleRoot, name), path.join(outputRoot, name));
    }
    return { manifest, archive: outputArchive };
  } finally {
    requireInside(os.tmpdir(), stage);
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = {};
    const names = { '--base-bundle': 'inputRoot', '--output-root': 'outputRoot', '--source-root': 'sourceRoot', '--grammar-root': 'grammarRoot', '--model-root': 'modelRoot', '--platform': 'platform' };
    for (let index = 2; index < process.argv.length; index += 2) {
      const name = names[process.argv[index]];
      const value = process.argv[index + 1];
      if (!name || !value) throw new Error('Usage: node build.mjs [--base-bundle DIR] [--output-root DIR] [--source-root DIR] [--grammar-root DIR] [--model-root DIR] [--platform NAME]');
      options[name] = value;
    }
    console.log(JSON.stringify(buildBundle(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
