import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Call edge function for admin actions
 * Used for: force resolve, force refund, mark disputed, ban player, flag player, etc.
 */
export async function callAdminAction(
    action: 'force_resolve' | 'force_refund' | 'mark_disputed' | 'ban_player' | 'flag_player' | 'unban_player',
    payload: Record<string, any>,
    adminWallet: string
) {
    try {
        const response = await fetch('/api/admin/action', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                adminWallet,
                ...payload,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to execute admin action');
        }

        return await response.json();
    } catch (error) {
        console.error(`[Admin Action] Error executing ${action}:`, error);
        throw error;
    }
}

/**
 * Force resolve a wager
 */
export async function forceResolveWager(
    wagerId: string,
    winnerWallet: string,
    adminWallet: string,
    notes?: string
) {
    return callAdminAction('force_resolve', {
        wagerId,
        winnerWallet,
        notes,
    }, adminWallet);
}

/**
 * Force refund a wager
 */
export async function forceRefundWager(
    wagerId: string,
    adminWallet: string,
    notes?: string
) {
    return callAdminAction('force_refund', {
        wagerId,
        notes,
    }, adminWallet);
}

/**
 * Mark wager as disputed
 */
export async function markWagerDisputed(
    wagerId: string,
    adminWallet: string,
    reason?: string
) {
    return callAdminAction('mark_disputed', {
        wagerId,
        reason,
    }, adminWallet);
}

/**
 * Ban a player
 */
export async function banPlayer(
    playerWallet: string,
    adminWallet: string,
    reason: string
) {
    return callAdminAction('ban_player', {
        playerWallet,
        reason,
    }, adminWallet);
}

/**
 * Flag a player for review
 */
export async function flagPlayer(
    playerWallet: string,
    adminWallet: string,
    reason: string
) {
    return callAdminAction('flag_player', {
        playerWallet,
        reason,
    }, adminWallet);
}

/**
 * Unban a player
 */
export async function unbanPlayer(
    playerWallet: string,
    adminWallet: string
) {
    return callAdminAction('unban_player', {
        playerWallet,
    }, adminWallet);
}

/**
 * Get wager details
 */
export async function getWagerDetails(wagerId: string) {
    try {
        const { data, error } = await supabase
            .from('wagers')
            .select('*')
            .eq('id', wagerId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Admin Queries] Error fetching wager details:', error);
        throw error;
    }
}

/**
 * Get all wagers
 */
export async function getAllWagers(
    status?: string,
    limit = 50,
    offset = 0
) {
    try {
        let query = supabase
            .from('wagers')
            .select('*, players:wager_players(*)', { count: 'exact' });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error, count } = await query
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, total: count || 0 };
    } catch (error) {
        console.error('[Admin Queries] Error fetching wagers:', error);
        throw error;
    }
}

/**
 * Get all users
 */
export async function getAllUsers(
    limit = 50,
    offset = 0
) {
    try {
        const { data, error, count } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, total: count || 0 };
    } catch (error) {
        console.error('[Admin Queries] Error fetching users:', error);
        throw error;
    }
}

/**
 * Get user details
 */
export async function getUserDetails(walletAddress: string) {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('wallet_address', walletAddress)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Admin Queries] Error fetching user details:', error);
        throw error;
    }
}

/**
 * Get all disputed wagers
 */
export async function getAllDisputedWagers(
    limit = 50,
    offset = 0
) {
    try {
        const { data, error, count } = await supabase
            .from('wagers')
            .select('*')
            .eq('status', 'disputed')
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, total: count || 0 };
    } catch (error) {
        console.error('[Admin Queries] Error fetching disputed wagers:', error);
        throw error;
    }
}

/**
 * Get admin audit logs
 */
export async function getAdminLogs(
    limit = 100
) {
    try {
        const { data, error } = await supabase
            .from('admin_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Admin Queries] Error fetching admin logs:', error);
        throw error;
    }
}
