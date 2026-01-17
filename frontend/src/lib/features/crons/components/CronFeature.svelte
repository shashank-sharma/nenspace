<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Plus, Search, Filter } from 'lucide-svelte';
	import { cronService } from '../services';
	import type { Cron } from '../types';
	import { toast } from 'svelte-sonner';
	import CronList from './CronList.svelte';
	import CronForm from './CronForm.svelte';
	import { goto as navigate } from '$app/navigation';
	import { pb } from '$lib/config/pocketbase';
	import { convertToCron } from '../services/cron.service';

	let allCrons = $state<Cron[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let filterActive = $state<boolean | undefined>(undefined);
	let showCreateDialog = $state(false);
	let selectedCronId = $state<string | null>(null);
	let unsubscribeCrons: (() => void) | null = null;
	let hasInitialized = $state(false);

	const crons = $derived.by(() => {
		let filtered = allCrons.filter(c => !c.is_system);
		
		if (filterActive !== undefined) {
			filtered = filtered.filter(c => c.is_active === filterActive);
		}
		
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				c => c.name.toLowerCase().includes(query) ||
				(c.description?.toLowerCase().includes(query) ?? false)
			);
		}
		
		return filtered;
	});

	$effect(() => {
		const urlCronId = $page.url.searchParams.get('id');
		if (urlCronId && urlCronId !== selectedCronId) {
			selectedCronId = urlCronId;
		} else if (!urlCronId && selectedCronId) {
			selectedCronId = null;
		}
	});

	async function loadCrons() {
		isLoading = true;
		try {
			const filters: { is_active?: boolean; is_system?: boolean } = {};
			filters.is_system = false;

			const result = await cronService.fetchCrons(filters);
			allCrons = result || [];
		} catch (error) {
			toast.error('Failed to load crons');
			console.error(error);
			allCrons = [];
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (hasInitialized) return;
		hasInitialized = true;

		loadCrons().then(() => {
			if (unsubscribeCrons) return;

			pb.collection('crons')
				.subscribe('*', (e: { action: string; record: any }) => {
					const cron = convertToCron(e.record);
					
					if (e.action === 'create') {
						if (!cron.is_system && !allCrons.find(c => c.id === cron.id)) {
							allCrons = [...allCrons, cron];
						}
					} else if (e.action === 'update') {
						const index = allCrons.findIndex(c => c.id === cron.id);
						if (index !== -1) {
							allCrons[index] = cron;
							allCrons = [...allCrons];
						} else if (!cron.is_system) {
							allCrons = [...allCrons, cron];
						}
					} else if (e.action === 'delete') {
						allCrons = allCrons.filter(c => c.id !== e.record.id);
					}
				})
				.then((unsub) => {
					unsubscribeCrons = unsub;
				})
				.catch((error) => {
					console.error('Failed to subscribe to crons:', error);
				});
		});

		return () => {
			if (unsubscribeCrons) {
				unsubscribeCrons();
				unsubscribeCrons = null;
			}
		};
	});

	function handleCreate() {
		showCreateDialog = true;
	}

	function handleCreateSuccess() {
		showCreateDialog = false;
	}

	function handleSelect(cron: Cron) {
		navigate(`/dashboard/crons/${cron.id}`);
	}

	function handleDelete(cron: Cron) {
		if (confirm(`Are you sure you want to delete "${cron.name}"?`)) {
			cronService.deleteCron(cron.id).then(() => {
				toast.success('Cron deleted successfully');
				if (selectedCronId === cron.id) {
					selectedCronId = null;
					const url = new URL($page.url);
					url.searchParams.delete('id');
					navigate(url.pathname + url.search, { replaceState: true, noScroll: true });
				}
			}).catch((error) => {
				toast.error('Failed to delete cron');
				console.error(error);
			});
		}
	}
</script>

<div class="container py-6 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold">Cron Jobs</h1>
			<p class="text-muted-foreground">Manage your scheduled webhook tasks</p>
		</div>
		<Button on:click={handleCreate}>
			<Plus class="h-4 w-4 mr-2" />
			Create Cron
		</Button>
	</div>

	<div class="flex gap-4">
		<div class="flex-1">
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-4">
						<div class="relative flex-1">
							<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								type="text"
								placeholder="Search crons..."
								bind:value={searchQuery}
								class="pl-9"
							/>
						</div>
						<div class="flex gap-2">
							<Button
								variant={filterActive === undefined ? 'default' : 'outline'}
								size="sm"
								on:click={() => {
									filterActive = undefined;
								}}
							>
								All
							</Button>
							<Button
								variant={filterActive === true ? 'default' : 'outline'}
								size="sm"
								on:click={() => {
									filterActive = true;
								}}
							>
								Active
							</Button>
							<Button
								variant={filterActive === false ? 'default' : 'outline'}
								size="sm"
								on:click={() => {
									filterActive = false;
								}}
							>
								Paused
							</Button>
						</div>
					</div>
				</Card.Header>
				<Card.Content>
					<CronList
						{crons}
						{isLoading}
						{selectedCronId}
						onSelect={handleSelect}
						onDelete={handleDelete}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	</div>

	<Dialog.Root bind:open={showCreateDialog}>
		<Dialog.Content class="max-w-2xl max-h-[90vh] overflow-y-auto">
			<Dialog.Header>
				<Dialog.Title>Create Cron Job</Dialog.Title>
				<Dialog.Description>
					Configure a new scheduled webhook task
				</Dialog.Description>
			</Dialog.Header>
			<CronForm onSuccess={handleCreateSuccess} onCancel={() => showCreateDialog = false} />
		</Dialog.Content>
	</Dialog.Root>
</div>
