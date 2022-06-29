import createDebug from 'debug';
import { PresencePermissions } from '../../api/coral-types.js';
import type { Arguments as ParentArguments } from '../nso.js';
import { ArgumentsCamelCase, Argv, YargsArguments } from '../../util/yargs.js';
import { initStorage } from '../../util/storage.js';
import { getToken } from '../../common/auth/nso.js';

const debug = createDebug('cli:nso:permissions');

export const command = 'permissions';
export const desc = 'Get or update Nintendo Switch presence permissions';

export function builder(yargs: Argv<ParentArguments>) {
    return yargs.option('user', {
        describe: 'Nintendo Account ID',
        type: 'string',
    }).option('token', {
        describe: 'Nintendo Account session token',
        type: 'string',
    }).option('json', {
        describe: 'Output raw JSON',
        type: 'boolean',
    }).option('json-pretty-print', {
        describe: 'Output pretty-printed JSON',
        type: 'boolean',
    }).option('presence', {
        describe: 'New presence permission',
        type: 'string',
    });
}

type Arguments = YargsArguments<ReturnType<typeof builder>>;

export async function handler(argv: ArgumentsCamelCase<Arguments>) {
    if (argv.presence && !['FRIENDS', 'FAVORITE_FRIENDS', 'SELF'].includes(argv.presence)) {
        throw new Error('Invalid permissions');
    }

    const storage = await initStorage(argv.dataPath);

    const usernsid = argv.user ?? await storage.getItem('SelectedUser');
    const token: string = argv.token ||
        await storage.getItem('NintendoAccountToken.' + usernsid);
    const {nso, data} = await getToken(storage, token, argv.zncProxyUrl);

    const permissions = await nso.getCurrentUserPermissions();

    if (argv.presence) {
        await nso.updateCurrentUserPermissions(argv.presence as PresencePermissions,
            permissions.result.permissions.presence, permissions.result.etag);
    } else {
        if (argv.jsonPrettyPrint) {
            console.log(JSON.stringify(permissions.result, null, 4));
            return;
        }
        if (argv.json) {
            console.log(JSON.stringify(permissions.result));
            return;
        }

        console.log('Presence is visible to %s', permissions.result.permissions.presence);
    }
}
