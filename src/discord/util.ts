import DiscordRPC from 'discord-rpc';
import { ActiveEvent, CurrentUser, Friend, Game, PresenceState } from '../api/coral-types.js';
import { defaultTitle, titles } from './titles.js';
import { product, version } from '../util/product.js';
import { getTitleIdFromEcUrl, hrduration } from '../util/misc.js';
import { ZncDiscordPresence, ZncProxyDiscordPresence } from '../common/presence.js';

export function getDiscordPresence(
    state: PresenceState, game: Game, context?: DiscordPresenceContext
): DiscordPresence {
    const titleid = getTitleIdFromEcUrl(game.shopUri);
    const titleList = titles.filter(t => t.id === titleid); 

    const TEMP_COUNTRY_CONFIG = 'en-US'; //Intl.DateTimeFormat().resolvedOptions().locale

    let t; if (titleList.length >= 2) t = titleList.find(item => item.locale === TEMP_COUNTRY_CONFIG);
    else t = titleList[0];
    const title = t || defaultTitle;

    const text: (string | undefined)[] = [];

    if (title.titleName === true) text.push(game.name);
    else if (title.titleName) text.push(title.titleName);

    const online = state === PresenceState.PLAYING;
    const members = context?.activeevent?.members.filter(m => m.isPlaying);
    const event_text = title.showActiveEvent && context?.activeevent ?
        ' (' + members?.length + ' player' + (members?.length === 1 ? '' : 's') +
        ')' : '';

    if ((title.showDescription ?? true) && game.sysDescription) text.push(game.sysDescription + event_text);
    else if (online && title.showPlayingOnline === true) text.push('Playing online' + event_text);
    else if (online && title.showPlayingOnline) text.push(title.showPlayingOnline as string + event_text);

    // Always show play time as `state`, not `details`
    // This doesn't normally have a noticeable effect, but the Active Now panel does show details/state differently
    if (!text.length) text.push(undefined);

    let play_time_text;
    if ((title.showPlayTime ?? true) && game.totalPlayTime >= 60) {
        play_time_text = getPlayTimeText(DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE, game);
    } else if ((title.showPlayTime ?? true)) {
        play_time_text = getPlayTimeText(DiscordPresencePlayTime.NINTENDO, game);
    }
    if (play_time_text) text.push(play_time_text);

    const nintendo_eshop_redirect_url = titleid ?
        'https://fancy.org.uk/api/nxapi/title/' + titleid + '/redirect?source=nxapi-' + version + '-discord' : null;

    const activity: DiscordRPC.Presence = {
        details: text[0],
        state: text[1],
        largeImageKey: title.largeImageKey ?? game.imageUri,
        largeImageText: title.largeImageText ? title.largeImageText + ' | ' + product : product,
        smallImageKey: title.smallImageKey || (context?.friendcode ? context?.user?.imageUri : undefined),
        smallImageText: title.smallImageKey ? title.smallImageText :
            context?.friendcode && context?.user?.imageUri ? 'SW-' + context.friendcode.id : undefined,
        buttons: game.shopUri ? [
            {
                label: 'Nintendo eShop',
                url: nintendo_eshop_redirect_url ?? game.shopUri,
            },
        ] : [],
    };

    if (online && title.showActiveEvent) {
        activity.buttons!.push({
            label: context?.activeevent?.shareUri ? 'Join' : 'Join via Nintendo Switch',
            url: context?.activeevent?.shareUri ?? 'https://lounge.nintendo.com',
        });
    }

    title.callback?.call(null, activity, game, context);

    return {
        id: title.client || defaultTitle.client,
        title: titleid,
        activity,
        showTimestamp: title.showTimestamp ?? true,
    };
}

function getPlayTimeText(type: DiscordPresencePlayTime, game: Game) {
    if (type === DiscordPresencePlayTime.NINTENDO) {
        const days = Math.floor(Date.now() / 1000 / 86400) - Math.floor(game.firstPlayedAt / 86400);
        if (days <= 10) return getFirstPlayedText(game.firstPlayedAt);
        if (game.totalPlayTime < 60) return 'Played for a little while';
        return 'Played for ' + hrduration(getApproximatePlayTime(game.totalPlayTime)) + ' or more';
    }

    if (type === DiscordPresencePlayTime.HIDDEN || game.totalPlayTime < 0) return null;

    const since = game.firstPlayedAt ? new Date(game.firstPlayedAt * 1000).toLocaleDateString() : 'now';

    switch (type) {
        case DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME:
            if (game.totalPlayTime < 60) return null;
            return 'Played for ' + hrduration(getApproximatePlayTime(game.totalPlayTime)) + ' or more';
        case DiscordPresencePlayTime.APPROXIMATE_PLAY_TIME_SINCE:
            if (game.totalPlayTime < 60) return null;
            return 'Played for ' + hrduration(getApproximatePlayTime(game.totalPlayTime)) + ' or more since ' + since;
        case DiscordPresencePlayTime.DETAILED_PLAY_TIME:
            return 'Played for ' + hrduration(game.totalPlayTime);
        case DiscordPresencePlayTime.DETAILED_PLAY_TIME_SINCE:
            return 'Played for ' + hrduration(game.totalPlayTime) + ' since ' + since;
    }

    return null;
}

function getFirstPlayedText(first_played_at: number) {
    const minutes = Math.floor(Date.now() / 1000 / 60) - Math.floor(first_played_at / 60);
    if (minutes <= 0) return null;

    if (minutes <= 60) {
        return 'First played ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
    }

    const hours = Math.floor(Date.now() / 1000 / 3600) - Math.floor(first_played_at / 3600);
    if (hours <= 24) {
        return 'First played ' + hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
    }

    const days = Math.floor(Date.now() / 1000 / 86400) - Math.floor(first_played_at / 86400);
    return 'First played ' + days + ' day' + (days === 1 ? '' : 's') + ' ago';
}

function getApproximatePlayTime(minutes: number) {
    if (minutes < 300) {
        // Less than 5 hours
        return Math.floor(minutes / 60) * 60;
    } else {
        return Math.floor(minutes / 300) * 300;
    }
}

export function getInactiveDiscordPresence(
    state: PresenceState, logoutAt: number, context?: DiscordPresenceContext
): DiscordPresence {
    return {
        id: defaultTitle.client,
        title: null,
        activity: {
            state: 'Not playing',
            largeImageKey: 'nintendoswitch',
            largeImageText: product,
            smallImageKey: context?.friendcode ? context?.user?.imageUri : undefined,
            smallImageText: context?.friendcode && context?.user?.imageUri ? 'SW-' + context.friendcode.id : undefined,
        },
    };
}

export interface DiscordPresenceContext {
    friendcode?: CurrentUser['links']['friendCode'];
    activeevent?: ActiveEvent;
    show_play_time?: DiscordPresencePlayTime;
    znc_discord_presence?: ZncDiscordPresence | ZncProxyDiscordPresence;
    nsaid?: string;
    user?: CurrentUser | Friend;
}

export interface DiscordPresence {
    id: string;
    title: string | null;
    activity: DiscordRPC.Presence;
    showTimestamp?: boolean;
}

export function getTitleConfiguration(game: Game, id: string) {
    return titles.find(title => {
        if (title.id !== id) return false;

        return true;
    });
}

type SystemModuleTitleId = `01000000000000${string}`;
type SystemDataTitleId = `01000000000008${string}`;
type SystemAppletTitleId = `0100000000001${string}`;
type ApplicationTitleId = `0100${string}${'0' | '2' | '4' | '6' | '8' | 'a' | 'c' | 'e'}000`;

export interface Title {
    /**
     * Lowercase hexadecimal title ID.
     *
     * Valid application title IDs are 16 characters long, and should start with `0100` and end with `0000`, `2000`, `4000`, `6000`, `8000`, `a000`, `c000`, `e000` (this is because applications have 16^4 title IDs for the application itself, plus addon content and update data).
     */
    id: ApplicationTitleId | '0000000000000000';
    /**
     * Discord client ID
     */
    client: string;

    /**
     * Title name to show in Discord. This is *not* the name that will appear under the user's name after "Playing ".
     *
     * If this is set to true the title's name from znc will be used.
     * If this is set to false (default) no title name will be set. This should be used when a specific Discord client for the title is used.
     * If this is set to a string it will be used as the title name.
     *
     * @default false
     */
    titleName?: string | boolean;
    //comment
    locale?: string;
    /**
     * By default the title's icon from znc will be used. (No icons need to be uploaded to Discord.)
     */
    largeImageKey?: string;
    largeImageText?: string;
    /**
     * By default the user's icon and friend code will be used if the user is sharing their friend code; otherwise it will not be set.
     */
    smallImageKey?: string;
    smallImageText?: string;
    /**
     * Whether to show the timestamp the user started playing the title in Discord. Discord shows this as the number of minutes and seconds since the timestamp.
     *
     * If enabled this is set to the time the user's presence was last updated as reported by Nintendo. Any changes to the updated timestamp will be ignored as long as the title doesn't change. The timestamp may change if the presence tracking is reset for any reason.
     *
     * This is now enabled by default as it's required for the activity to show in the Active Now panel.
     *
     * @default true
     */
    showTimestamp?: boolean;
    /**
     * Show the activity description set by the title.
     *
     * @default true
     */
    showDescription?: boolean;
    /**
     * Show "Playing online" if playing online and the game doesn't set activity details.
     *
     * @default false
     */
    showPlayingOnline?: string | boolean;
    /**
     * Whether to show details of the current event (Online Lounge/voice chat) in Discord.
     *
     * @default false
     */
    showActiveEvent?: boolean;
    /**
     * Whether to show "Played for ... since ..." in Discord.
     *
     * @default true
     */
    showPlayTime?: boolean;

    /**
     * A function to call to customise the Discord activity.
     */
    callback?: (activity: DiscordRPC.Presence, game: Game, context?: DiscordPresenceContext) => void;
}

export enum DiscordPresencePlayTime {
    /** Don't show play time */
    HIDDEN,
    /** "First played x minutes/hours/days ago" or "Played for [x5] hours or more" */
    NINTENDO,
    /** "Played for [x5] hours or more" */
    APPROXIMATE_PLAY_TIME,
    /** "Played for [x5] hours or more since dd/mm/yyyy" */
    APPROXIMATE_PLAY_TIME_SINCE,
    /** "Played for x hours and x minutes" */
    DETAILED_PLAY_TIME,
    /** "Played for x hours and x minutes since dd/mm/yyyy" */
    DETAILED_PLAY_TIME_SINCE,
}
