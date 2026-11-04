"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acquireEmbedLock = acquireEmbedLock;
/**
 * 임베딩 계산을 PC 전체에서 한 프로세스씩만 하게 하는 잠금. 감시 데몬 여럿이 동시에
 * 재임베딩해 CPU 를 다 쓰는 일을 막음. 잠금 파일은 임베딩 캐시와 같은 폴더에 둠.
 * 소유 프로세스가 죽었거나 갱신이 끊기면 낡은 잠금으로 보고 빼앗음.
 */
const fs = require("fs");
const path = require("path");
const STALE_MS = 120000;
const POLL_MS = 1500;
const DEFAULT_MAX_WAIT_MS = 60 * 60 * 1000;
function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === 'EPERM';
    }
}
function isStale(lockPath) {
    try {
        const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        if (!isAlive(owner.pid))
            return true;
        return Date.now() - fs.statSync(lockPath).mtimeMs > STALE_MS;
    }
    catch {
        // 읽는 도중 지워졌거나 내용이 깨짐. 깨진 파일은 갱신 시각으로만 판단함
        try {
            return Date.now() - fs.statSync(lockPath).mtimeMs > STALE_MS;
        }
        catch {
            return false;
        }
    }
}
/**
 * 잠금을 얻을 때까지 기다림. maxWaitMs 를 넘기면 null 을 돌려 호출자가 잠금 없이 진행하게 함.
 * 돌려주는 값: { touch(), release() }. 배치마다 touch 로 갱신 시각을 밀어야 낡은 잠금으로 취급되지 않음.
 */
async function acquireEmbedLock({ dir, maxWaitMs = DEFAULT_MAX_WAIT_MS, onWait } = {}) {
    const lockPath = path.join(dir, 'embed.lock');
    fs.mkdirSync(dir, { recursive: true });
    const started = Date.now();
    let announced = false;
    for (;;) {
        try {
            const fd = fs.openSync(lockPath, 'wx');
            fs.writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
            fs.closeSync(fd);
            return {
                touch() {
                    try {
                        const now = new Date();
                        fs.utimesSync(lockPath, now, now);
                    }
                    catch {
                        // 잠금 파일이 사라졌으면 다음 배치가 다시 얻지 않고 진행함
                    }
                },
                release() {
                    try {
                        const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
                        if (owner.pid === process.pid)
                            fs.unlinkSync(lockPath);
                    }
                    catch {
                        // 이미 없음
                    }
                },
            };
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                return null;
        }
        if (isStale(lockPath)) {
            try {
                fs.unlinkSync(lockPath);
            }
            catch {
                // 다른 프로세스가 먼저 빼앗음
            }
            continue;
        }
        if (Date.now() - started > maxWaitMs)
            return null;
        if (!announced) {
            announced = true;
            onWait?.();
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
}
//# sourceMappingURL=embed-lock.js.map
