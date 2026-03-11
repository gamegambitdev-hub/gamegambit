'use client';

import { Suspense } from 'react';
import { ProtectedRoute } from '@/components/admin';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Search, Filter } from 'lucide-react';
import { useState } from 'react';

function UsersContent() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'banned'>('all');

    // Placeholder data - will be replaced with actual data fetching
    const users = [
        {
            id: '1',
            wallet: '3h7fWbXXe1Z3eaJ6xB5N9pV2m8K4j9dY6rQ5xN7k',
            username: 'Player1',
            joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            wagers: 15,
            wins: 10,
            losses: 5,
            status: 'active',
        },
        {
            id: '2',
            wallet: '2mX9vR3fL6bD2pQ4jK8eJ1xW5sN7tZ9mY3cA8vF',
            username: 'Player2',
            joinedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            wagers: 8,
            wins: 4,
            losses: 4,
            status: 'active',
        },
    ];

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.wallet.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.username.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-3">
                            <UsersIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-gaming font-bold text-glow">User Management</h1>
                            <p className="text-muted-foreground">View and manage all users in the system</p>
                        </div>
                    </div>
                </motion.div>

                {/* Search & Filter */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass rounded-2xl p-4 border border-primary/20 space-y-4"
                >
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by wallet address or username..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'banned')}
                                className="bg-card border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                            >
                                <option value="all">All Users</option>
                                <option value="active">Active</option>
                                <option value="banned">Banned</option>
                            </select>
                        </div>
                    </div>
                </motion.div>

                {/* Users Table */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50 bg-card/50">
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wallet</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Username</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Joined</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Wagers</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">W/L</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Status</th>
                                    <th className="px-6 py-4 text-left text-sm font-gaming font-bold text-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                                        <td className="px-6 py-4 text-xs font-mono text-muted-foreground">{user.wallet.slice(0, 12)}...</td>
                                        <td className="px-6 py-4 text-sm text-foreground font-medium">{user.username}</td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">{user.joinedAt.toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{user.wagers}</td>
                                        <td className="px-6 py-4 text-sm text-foreground">{user.wins}W / {user.losses}L</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${user.status === 'active' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                                                }`}>
                                                {user.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <button className="text-primary hover:text-primary/80 transition-colors">View</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        No users found matching your search criteria.
                    </div>
                )}
            </div>
        </ProtectedRoute>
    );
}

export default function UsersPage() {
    return (
        <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Loading users...</div>}>
            <UsersContent />
        </Suspense>
    );
}
