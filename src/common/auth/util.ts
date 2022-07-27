import createDebug from 'debug';
import * as persist from 'node-persist';

const debug = createDebug('nxapi:auth:util');

// If the parent process is a terminal, then the user is attempting to run the command manually,
// so we shouldn't restrict how many attempts they can use. If not, the command is being run by
// a script/some other program, which should be limited in case it continues to run the command
// if it fails. The Electron app overrides this as the parent process (probably) won't be a
// terminal, but most attempts to call getToken won't be automated.
export const SHOULD_LIMIT_USE = !process.stdout.isTTY;
const LIMIT_REQUESTS = 4;
const LIMIT_PERIOD = 60 * 60 * 1000; // 60 minutes

type RateLimitAttempts = number[];

export async function checkUseLimit(
    storage: persist.LocalStorage,
    key: string, user: string
) {
    let attempts: RateLimitAttempts = await storage.getItem('RateLimitAttempts-' + key + '.' + user) ?? [];
    attempts = attempts.filter(a => a >= Date.now() - LIMIT_PERIOD);

    if (attempts.length >= LIMIT_REQUESTS) {
        throw new Error('Too many attempts to authenticate');
    }

    attempts.unshift(Date.now());
    await storage.setItem('RateLimitAttempts-' + key + '.' + user, attempts);
}
