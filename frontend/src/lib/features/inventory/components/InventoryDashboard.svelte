<script lang="ts">
    import { onMount } from 'svelte';
    import { InventoryService } from '../services';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
    import { Package, DollarSign, AlertTriangle, CreditCard, TrendingUp } from 'lucide-svelte';
    import { Badge } from '$lib/components/ui/badge';
    import { INVENTORY_ITEM_TYPES, INVENTORY_CATEGORIES } from '../constants';
    import InventoryCard from './InventoryCard.svelte';
    import type { InventoryItem } from '../types';
    import * as React from 'react';
    import {
        BarChart,
        Bar,
        PieChart,
        Pie,
        Cell,
        XAxis,
        YAxis,
        CartesianGrid,
        Tooltip,
        Legend,
        ResponsiveContainer,
        LineChart,
        Line,
    } from 'recharts';
    import RechartsWrapper from '$lib/components/recharts/RechartsWrapper.svelte';

    let stats = $state<{
        totalItems: number;
        totalValue: number;
        expiringSoon: number;
        activeSubscriptions: number;
        itemsByType: Record<string, number>;
        itemsByCategory: Record<string, number>;
    } | null>(null);
    let isLoading = $state(true);
    let recentItems = $state<InventoryItem[]>([]);
    let expiringItems = $state<InventoryItem[]>([]);
    let expiringSubscriptions = $state<InventoryItem[]>([]);

    let allItemsForCharts = $state<InventoryItem[]>([]);

    async function loadDashboardData() {
        isLoading = true;
        try {
            stats = await InventoryService.getDashboardStats();
            allItemsForCharts = await InventoryService.getItems();
            recentItems = allItemsForCharts.slice(0, 5).sort((a, b) => 
                new Date(b.created).getTime() - new Date(a.created).getTime()
            );
            expiringItems = await InventoryService.getExpiringItems(7);
            expiringSubscriptions = await InventoryService.getExpiringSubscriptions(30);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            isLoading = false;
        }
    }

    onMount(() => {
        loadDashboardData();
    });

    const statCards = [
        {
            title: 'Total Items',
            icon: Package,
            getValue: () => stats?.totalItems ?? 0,
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-500/10',
        },
        {
            title: 'Total Value',
            icon: DollarSign,
            getValue: () => `$${(stats?.totalValue ?? 0).toFixed(2)}`,
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-500/10',
        },
        {
            title: 'Expiring Soon',
            icon: AlertTriangle,
            getValue: () => stats?.expiringSoon ?? 0,
            color: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-orange-500/10',
        },
        {
            title: 'Active Subscriptions',
            icon: CreditCard,
            getValue: () => stats?.activeSubscriptions ?? 0,
            color: 'text-purple-600 dark:text-purple-400',
            bgColor: 'bg-purple-500/10',
        },
    ];

    const itemsByTypeData = $derived(() => {
        if (!stats) return [];
        return INVENTORY_ITEM_TYPES.map(type => ({
            name: type.label,
            value: stats.itemsByType[type.value] || 0,
            color: type.color.split(' ')[0],
        })).filter(item => item.value > 0);
    });

    const itemsByCategoryData = $derived(() => {
        if (!stats) return [];
        return INVENTORY_CATEGORIES.map(cat => ({
            name: cat.label,
            value: stats.itemsByCategory[cat.value] || 0,
        })).filter(item => item.value > 0);
    });

    const spendingOverTimeData = $derived(() => {
        const spendingMap = new Map<string, number>();
        
        for (const item of allItemsForCharts) {
            if (item.purchase_date && item.purchase_price && item.purchase_price > 0) {
                const date = new Date(item.purchase_date);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                spendingMap.set(monthKey, (spendingMap.get(monthKey) || 0) + (item.purchase_price || 0));
            }
        }

        return Array.from(spendingMap.entries())
            .map(([month, value]) => ({
                month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                spending: value,
            }))
            .sort((a, b) => {
                const dateA = new Date(a.month);
                const dateB = new Date(b.month);
                return dateA.getTime() - dateB.getTime();
            })
            .slice(-12); // Last 12 months
    });

    const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
</script>

<div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {#each statCards as card}
            <Card class="p-6">
                <div class="flex items-center space-x-4">
                    <div class={`p-3 rounded-full ${card.bgColor}`}>
                        <svelte:component
                            this={card.icon}
                            class={`h-6 w-6 ${card.color}`}
                        />
                    </div>
                    <div>
                        <p class="text-sm text-muted-foreground">{card.title}</p>
                        {#if isLoading}
                            <div class="h-8 w-16 bg-muted animate-pulse rounded-md mt-1"></div>
                        {:else}
                            <h3 class="text-2xl font-bold mt-1">
                                {card.getValue()}
                            </h3>
                        {/if}
                    </div>
                </div>
            </Card>
        {/each}
    </div>

    <!-- Charts Section -->
    {#if stats && !isLoading}
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Items by Type Chart -->
            {#if itemsByTypeData().length > 0}
                <Card>
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <TrendingUp class="h-5 w-5" />
                            Items by Type
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="w-full" style="height: 300px;">
                            <RechartsWrapper
                                component={ResponsiveContainer}
                                props={{
                                    width: "100%",
                                    height: 300,
                                    children: React.createElement(BarChart, {
                                        data: itemsByTypeData(),
                                        children: [
                                            React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                            React.createElement(XAxis, { dataKey: "name" }),
                                            React.createElement(YAxis),
                                            React.createElement(Tooltip),
                                            React.createElement(Bar, { dataKey: "value", fill: "#3b82f6" }),
                                        ],
                                    }),
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            {/if}

            <!-- Category Distribution Chart -->
            {#if itemsByCategoryData().length > 0}
                <Card>
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <TrendingUp class="h-5 w-5" />
                            Category Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="w-full" style="height: 300px;">
                            <RechartsWrapper
                                component={ResponsiveContainer}
                                props={{
                                    width: "100%",
                                    height: 300,
                                    children: React.createElement(PieChart, {
                                        children: [
                                            React.createElement(Pie, {
                                                data: itemsByCategoryData(),
                                                cx: "50%",
                                                cy: "50%",
                                                labelLine: false,
                                                label: ({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`,
                                                outerRadius: 80,
                                                fill: "#8884d8",
                                                dataKey: "value",
                                                children: itemsByCategoryData().map((entry: any, index: number) =>
                                                    React.createElement(Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
                                                ),
                                            }),
                                            React.createElement(Tooltip),
                                        ],
                                    }),
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            {/if}

            <!-- Spending Over Time Chart -->
            {#if spendingOverTimeData().length > 0}
                <Card class="lg:col-span-2">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <DollarSign class="h-5 w-5" />
                            Spending Over Time
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div class="w-full" style="height: 300px;">
                            <RechartsWrapper
                                component={ResponsiveContainer}
                                props={{
                                    width: "100%",
                                    height: 300,
                                    children: React.createElement(LineChart, {
                                        data: spendingOverTimeData(),
                                        children: [
                                            React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                                            React.createElement(XAxis, { dataKey: "month" }),
                                            React.createElement(YAxis),
                                            React.createElement(Tooltip, { formatter: (value: number) => `$${value.toFixed(2)}` }),
                                            React.createElement(Legend),
                                            React.createElement(Line, { type: "monotone", dataKey: "spending", stroke: "#10b981", strokeWidth: 2 }),
                                        ],
                                    }),
                                }}
                            />
                        </div>
                    </CardContent>
                </Card>
            {/if}
        </div>
    {/if}

    <!-- Alerts -->
    {#if (expiringItems.length > 0 || expiringSubscriptions.length > 0) && !isLoading}
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <AlertTriangle class="h-5 w-5" />
                    Alerts
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                {#if expiringItems.length > 0}
                    <div>
                        <h4 class="font-semibold mb-2">Items Expiring Soon ({expiringItems.length})</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {#each expiringItems.slice(0, 4) as item}
                                <div class="p-2 border rounded-md">
                                    <p class="font-medium">{item.name}</p>
                                    {#if item.expiration_date}
                                        <p class="text-sm text-muted-foreground">
                                            Expires: {new Date(item.expiration_date).toLocaleDateString()}
                                        </p>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
                {#if expiringSubscriptions.length > 0}
                    <div>
                        <h4 class="font-semibold mb-2">Subscriptions Expiring ({expiringSubscriptions.length})</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {#each expiringSubscriptions.slice(0, 4) as item}
                                <div class="p-2 border rounded-md">
                                    <p class="font-medium">{item.name}</p>
                                    {#if item.subscription_end}
                                        <p class="text-sm text-muted-foreground">
                                            Ends: {new Date(item.subscription_end).toLocaleDateString()}
                                        </p>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}

    <!-- Recent Items -->
    {#if recentItems.length > 0 && !isLoading}
        <Card>
            <CardHeader>
                <CardTitle>Recent Items</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each recentItems as item}
                        <InventoryCard {item} />
                    {/each}
                </div>
            </CardContent>
        </Card>
    {/if}
</div>

